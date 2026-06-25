/**
 * Market Scanner Service
 * Fetches and filters markets from Polymarket and Kalshi
 */

import { polymarketClient, type EnrichedPolymarketMarket } from "../clients/polymarket";
import { kalshiClient, type EnrichedKalshiMarket } from "../clients/kalshi";

// Filters for moderate volume markets (sweet spot: enough liquidity but not oversaturated)
const MIN_VOLUME_POLymarket = 15000; // $15K minimum 24h volume
const MIN_LIQUIDITY_POLymarket = 10000; // $10K minimum liquidity
const MIN_VOLUME_KALSHI = 5000; // $5K minimum 24h volume
const MIN_LIQUIDITY_KALSHI = 3000; // $3K minimum liquidity

// Maximum thresholds to avoid oversaturated markets
const MAX_VOLUME_POLymarket = 5_000_000; // Too much volume = efficient pricing
const MAX_VOLUME_KALSHI = 2_000_000;

// Minimum spread for analysis (tight spread = efficient)
const MAX_SPREAD_POLymarket = 0.15; // 15% max spread
const MAX_SPREAD_KALSHI = 15; // 15 cents max spread (Kalshi uses cents)

// Exclude categories that are too noisy or hard to predict
const EXCLUDED_POLymarkET_TAGS = [
  "meme",
  "crypto-price",
  "sports-betting",
];

const EXCLUDED_KALSHI_CATEGORIES: string[] = [
  "Crypto",
  "Sports",
];

export interface ScannedMarket {
  platform: "polymarket" | "kalshi";
  marketId: string;
  title: string;
  eventTitle?: string;
  enriched: EnrichedPolymarketMarket | EnrichedKalshiMarket;
  marketUrl?: string;
}

export async function scanPolymarket(): Promise<ScannedMarket[]> {
  console.log("[Scanner] Scanning Polymarket markets...");
  const results: ScannedMarket[] = [];

  try {
    // Fetch active events sorted by volume
    const events = await polymarketClient.getActiveEvents(100);

    for (const event of events) {
      if (!event.markets || !Array.isArray(event.markets)) continue;

      // Skip excluded categories
      if (event.tags?.some((t) => EXCLUDED_POLymarkET_TAGS.includes(t.slug))) {
        continue;
      }

      for (const market of event.markets) {
        // Skip non-active markets
        if (market.closed || !market.active) continue;

        const enriched = polymarketClient.enrichMarket(market);

        // Volume filter
        if (enriched.volume24hrNum < MIN_VOLUME_POLymarket) continue;
        if (enriched.volume24hrNum > MAX_VOLUME_POLymarket) continue;

        // Liquidity filter
        if (enriched.liquidityNum < MIN_LIQUIDITY_POLymarket) continue;

        // Spread filter
        if (enriched.spreadNum > MAX_SPREAD_POLymarket) continue;

        // Only binary yes/no markets for cleaner signals
        if (!market.outcomes?.includes("Yes")) continue;

        // Skip if too close to resolution (less than 1 hour) - avoid last-minute noise
        if (enriched.daysToResolution !== null && enriched.daysToResolution < 0.04) continue;

        // Skip if probability is too extreme (edge cases)
        if (enriched.impliedProbability < 0.02 || enriched.impliedProbability > 0.98) continue;

        results.push({
          platform: "polymarket",
          marketId: market.conditionId || market.id || market.slug,
          title: market.question || "Unknown",
          eventTitle: event.title,
          enriched,
          marketUrl: `https://polymarket.com/event/${event.slug}/${market.slug}`,
        });
      }
    }

    console.log(`[Scanner] Polymarket: ${results.length} markets passed filters`);
  } catch (err) {
    console.error("[Scanner] Polymarket scan error:", (err as Error).message);
  }

  return results;
}

export async function scanKalshi(): Promise<ScannedMarket[]> {
  console.log("[Scanner] Scanning Kalshi markets...");
  const results: ScannedMarket[] = [];

  try {
    // Fetch active events
    const { events } = await kalshiClient.getActiveEvents(100);

    for (const event of events) {
      if (!event.markets || !Array.isArray(event.markets)) continue;

      // Skip excluded categories
      if (event.category && EXCLUDED_KALSHI_CATEGORIES.includes(event.category)) {
        continue;
      }

      for (const market of event.markets) {
        // Skip non-open markets
        if (market.status !== "open") continue;

        const enriched = kalshiClient.enrichMarket(market);

        // Volume filter
        if (enriched.volume24hNum < MIN_VOLUME_KALSHI) continue;
        if (enriched.volume24hNum > MAX_VOLUME_KALSHI) continue;

        // Liquidity filter
        if (enriched.liquidityNum < MIN_LIQUIDITY_KALSHI) continue;

        // Spread filter (Kalshi spread is in cents)
        if (enriched.spread > MAX_SPREAD_KALSHI) continue;

        // Skip if too close to resolution
        if (enriched.daysToResolution !== null && enriched.daysToResolution < 0.04) continue;

        // Skip if probability is too extreme
        if (enriched.impliedProbability < 0.02 || enriched.impliedProbability > 0.98) continue;

        results.push({
          platform: "kalshi",
          marketId: market.ticker,
          title: market.title || "Unknown",
          eventTitle: event.title,
          enriched,
          marketUrl: `https://kalshi.com/markets/${event.ticker}/${market.ticker}`,
        });
      }
    }

    console.log(`[Scanner] Kalshi: ${results.length} markets passed filters`);
  } catch (err) {
    console.error("[Scanner] Kalshi scan error:", (err as Error).message);
  }

  return results;
}

export async function scanAllMarkets(): Promise<{
  polymarket: ScannedMarket[];
  kalshi: ScannedMarket[];
  total: number;
}> {
  const [polymarket, kalshi] = await Promise.all([
    scanPolymarket(),
    scanKalshi(),
  ]);

  return {
    polymarket,
    kalshi,
    total: polymarket.length + kalshi.length,
  };
}
