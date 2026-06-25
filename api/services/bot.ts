/**
 * Main Bot Orchestrator
 * Coordinates market scanning, signal analysis, and Telegram notifications
 */

import { scanAllMarkets } from "./scanner";
import {
  analyzePolymarketMarket,
  analyzeKalshiMarket,
  type SignalAnalysis,
} from "./analyzer";
import { sendSignal } from "../clients/telegram";
import type { ScannedMarket } from "./scanner";
import { getDb } from "../queries/connection";
import { signals, marketSnapshots, botLogs } from "@db/schema";
import { eq, and, gt, desc } from "drizzle-orm";
import type { EnrichedPolymarketMarket } from "../clients/polymarket";
import type { EnrichedKalshiMarket } from "../clients/kalshi";

export interface BotStats {
  totalScanned: number;
  totalSignals: number;
  polymarketScanned: number;
  kalshiScanned: number;
  lastScanTime: Date | null;
  isRunning: boolean;
}

let botStats: BotStats = {
  totalScanned: 0,
  totalSignals: 0,
  polymarketScanned: 0,
  kalshiScanned: 0,
  lastScanTime: null,
  isRunning: false,
};

export function getBotStats(): BotStats {
  return { ...botStats };
}

function isPolymarketEnriched(
  m: EnrichedPolymarketMarket | EnrichedKalshiMarket
): m is EnrichedPolymarketMarket {
  return "yesPrice" in m;
}

async function log(level: "info" | "warn" | "error" | "signal", message: string, details?: unknown) {
  console.log(`[Bot] [${level.toUpperCase()}] ${message}`);
  try {
    const db = getDb();
    await db.insert(botLogs).values({
      level,
      message,
      details: details ? JSON.stringify(details) : null,
    });
  } catch {
    // Silently fail - don't let logging break the bot
  }
}

export async function runBotScan(): Promise<{
  signalsGenerated: number;
  marketsScanned: number;
  errors: string[];
}> {
  if (botStats.isRunning) {
    console.log("[Bot] Scan already in progress, skipping...");
    return { signalsGenerated: 0, marketsScanned: 0, errors: ["Scan already in progress"] };
  }

  botStats.isRunning = true;
  const errors: string[] = [];
  let signalsGenerated = 0;

  try {
    await log("info", "Starting market scan cycle");

    // Scan all markets
    const { polymarket, kalshi, total } = await scanAllMarkets();
    botStats.totalScanned += total;
    botStats.polymarketScanned += polymarket.length;
    botStats.kalshiScanned += kalshi.length;
    botStats.lastScanTime = new Date();

    await log("info", `Scanned ${total} markets`, {
      polymarket: polymarket.length,
      kalshi: kalshi.length,
    });

    // Save market snapshots
    try {
      const db = getDb();
      const snapshots = [
        ...polymarket.map((m) => {
          const e = m.enriched as EnrichedPolymarketMarket;
          return {
            platform: "polymarket" as const,
            marketId: m.marketId,
            marketTitle: m.title,
            price: e.impliedProbability.toString(),
            volume24h: e.volume24hrNum.toString(),
            liquidity: e.liquidityNum.toString(),
            spread: e.spreadNum.toString(),
            openInterest: e.openInterestNum.toString(),
          };
        }),
        ...kalshi.map((m) => {
          const e = m.enriched as EnrichedKalshiMarket;
          return {
            platform: "kalshi" as const,
            marketId: m.marketId,
            marketTitle: m.title,
            price: e.impliedProbability.toString(),
            volume24h: e.volume24hNum.toString(),
            liquidity: e.liquidityNum.toString(),
            spread: (e.spread / 100).toString(),
            openInterest: e.openInterestNum.toString(),
          };
        }),
      ];

      if (snapshots.length > 0) {
        await db.insert(marketSnapshots).values(snapshots);
      }
    } catch (err) {
      errors.push(`Snapshot save error: ${(err as Error).message}`);
    }

    // Analyze Polymarket markets
    const allSignals: {
      scanned: ScannedMarket;
      analysis: SignalAnalysis;
    }[] = [];

    for (const scanned of polymarket) {
      try {
        if (isPolymarketEnriched(scanned.enriched)) {
          const analysis = analyzePolymarketMarket(scanned.enriched);
          if (analysis.shouldSignal && analysis.confidence >= 55) {
            allSignals.push({ scanned, analysis });
          }
        }
      } catch (err) {
        errors.push(`Polymarket analysis error for ${scanned.marketId}: ${(err as Error).message}`);
      }
    }

    // Analyze Kalshi markets
    for (const scanned of kalshi) {
      try {
        if (!isPolymarketEnriched(scanned.enriched)) {
          const analysis = analyzeKalshiMarket(scanned.enriched);
          if (analysis.shouldSignal && analysis.confidence >= 55) {
            allSignals.push({ scanned, analysis });
          }
        }
      } catch (err) {
        errors.push(`Kalshi analysis error for ${scanned.marketId}: ${(err as Error).message}`);
      }
    }

    // Sort by confidence (highest first)
    allSignals.sort((a, b) => b.analysis.confidence - a.analysis.confidence);

    // Take top signals to avoid spam (max 8 per scan cycle)
    const topSignals = allSignals.slice(0, 8);

    // Send signals to Telegram and save to DB
    for (const { scanned, analysis } of topSignals) {
      try {
        const db = getDb();

        // Check if we already sent a signal for this market recently (within 6 hours)
        const recentSignals = await db
          .select()
          .from(signals)
          .where(
            and(
              eq(signals.marketId, scanned.marketId),
              eq(signals.platform, scanned.platform),
              gt(signals.createdAt, new Date(Date.now() - 6 * 60 * 60 * 1000))
            )
          )
          .orderBy(desc(signals.createdAt))
          .limit(1);

        if (recentSignals.length > 0) {
          continue; // Skip duplicate within 6h window
        }

        // Determine outcome
        const outcome = analysis.direction === "UP" ? "Yes" : "No";

        // Get numeric values based on platform
        const isPoly = isPolymarketEnriched(scanned.enriched);
        const volume24h = isPoly
          ? (scanned.enriched as EnrichedPolymarketMarket).volume24hrNum
          : (scanned.enriched as EnrichedKalshiMarket).volume24hNum;
        const spreadVal = isPoly
          ? (scanned.enriched as EnrichedPolymarketMarket).spreadNum
          : (scanned.enriched as EnrichedKalshiMarket).spread / 100;

        // Save signal to database - get the ID
        const insertResult = await db.insert(signals).values({
          platform: scanned.platform,
          signalType: analysis.signalType,
          marketId: scanned.marketId,
          marketTitle: scanned.title,
          eventTitle: scanned.eventTitle || null,
          outcome,
          currentPrice: analysis.currentPrice.toString(),
          targetPrice: analysis.targetPrice?.toString() || null,
          confidence: analysis.confidence,
          volume24h: volume24h.toString(),
          liquidity: scanned.enriched.liquidityNum.toString(),
          spread: spreadVal.toString(),
          timeToResolution: scanned.enriched.daysToResolution
            ? Math.round(scanned.enriched.daysToResolution)
            : null,
          analysis: analysis.analysis,
          factors: analysis.factors,
        });

        const savedId = Number(insertResult[0]?.insertId) || 0;

        // Send to Telegram
        const messageId = await sendSignal({
          platform: scanned.platform,
          signalType: analysis.signalType,
          marketTitle: scanned.title,
          eventTitle: scanned.eventTitle,
          outcome,
          currentPrice: analysis.currentPrice,
          targetPrice: analysis.targetPrice,
          confidence: analysis.confidence,
          volume24h: volume24h,
          liquidity: scanned.enriched.liquidityNum,
          spread: spreadVal,
          timeToResolution: scanned.enriched.daysToResolution
            ? Math.round(scanned.enriched.daysToResolution)
            : undefined,
          analysis: analysis.analysis,
          factors: analysis.factors,
          marketUrl: scanned.marketUrl,
          direction: analysis.direction,
        });

        if (messageId && savedId > 0) {
          await db
            .update(signals)
            .set({
              telegramMessageId: messageId,
              sentToTelegram: true,
            })
            .where(eq(signals.id, savedId));
        }

        signalsGenerated++;
        botStats.totalSignals++;

        await log("signal", `Generated ${analysis.signalType} signal for ${scanned.title}`, {
          confidence: analysis.confidence,
          marketId: scanned.marketId,
          platform: scanned.platform,
        });
      } catch (err) {
        errors.push(`Signal send error for ${scanned.marketId}: ${(err as Error).message}`);
      }
    }

    await log("info", `Scan complete. Generated ${signalsGenerated} signals.`, {
      marketsScanned: total,
      signalsGenerated,
    });
  } catch (err) {
    const errorMsg = (err as Error).message;
    errors.push(`Scan error: ${errorMsg}`);
    await log("error", `Scan cycle failed: ${errorMsg}`);
  } finally {
    botStats.isRunning = false;
  }

  return { signalsGenerated, marketsScanned: botStats.totalScanned, errors };
}
