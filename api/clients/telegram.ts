/**
 * Telegram Bot Service
 * Sends prediction market signals to a Telegram channel
 */

import TelegramBot from "node-telegram-bot-api";
import { env } from "../lib/env";

let botInstance: TelegramBot | null = null;

function getBot(): TelegramBot | null {
  if (!env.telegramBotToken || !env.telegramChannelId) {
    console.warn("[Telegram] Bot token or channel ID not configured");
    return null;
  }
  if (!botInstance) {
    botInstance = new TelegramBot(env.telegramBotToken, { polling: false });
  }
  return botInstance;
}

export interface SignalMessage {
  platform: "polymarket" | "kalshi";
  signalType: "BUY" | "SELL" | "ARBITRAGE" | "MOMENTUM";
  marketTitle: string;
  eventTitle?: string;
  outcome: string;
  currentPrice: number;
  targetPrice?: number;
  confidence: number;
  volume24h: number;
  liquidity: number;
  spread: number;
  timeToResolution?: number;
  analysis: string;
  factors: string[];
  marketUrl?: string;
  direction: "UP" | "DOWN";
}

function formatPrice(price: number): string {
  if (price >= 1) {
    return `$${price.toFixed(2)}`;
  }
  return `${(price * 100).toFixed(1)}%`;
}

function formatVolume(vol: number): string {
  if (vol >= 1_000_000) {
    return `$${(vol / 1_000_000).toFixed(2)}M`;
  }
  if (vol >= 1_000) {
    return `$${(vol / 1_000).toFixed(1)}K`;
  }
  return `$${vol.toFixed(0)}`;
}

function getSignalEmoji(signalType: string, direction: string): string {
  const emojis: Record<string, Record<string, string>> = {
    BUY: { UP: "🟢 📈", DOWN: "🔴 📉" },
    SELL: { UP: "🔴 📈", DOWN: "🟢 📉" },
    ARBITRAGE: { UP: "💎 ⚡", DOWN: "💎 ⚡" },
    MOMENTUM: { UP: "🚀 📈", DOWN: "🔻 📉" },
  };
  return emojis[signalType]?.[direction] || "📊";
}

function getPlatformEmoji(platform: string): string {
  return platform === "polymarket" ? "🔷 Polymarket" : "🟠 Kalshi";
}

function getConfidenceStars(confidence: number): string {
  const filled = Math.round(confidence / 20);
  return "⭐".repeat(filled) + "☆".repeat(5 - filled);
}

export async function sendSignal(signal: SignalMessage): Promise<string | null> {
  const bot = getBot();
  if (!bot) {
    console.warn("[Telegram] Bot not initialized, skipping send");
    return null;
  }

  const emoji = getSignalEmoji(signal.signalType, signal.direction);
  const platformEmoji = getPlatformEmoji(signal.platform);
  const confidenceStars = getConfidenceStars(signal.confidence);

  const timeText =
    signal.timeToResolution !== undefined
      ? signal.timeToResolution < 24
        ? `${Math.round(signal.timeToResolution)}h`
        : `${Math.round(signal.timeToResolution / 24)}d`
      : "Unknown";

  let message = `${emoji} *${signal.signalType} SIGNAL* ${emoji}\n\n`;
  message += `${platformEmoji}\n\n`;
  message += `*📋 ${signal.marketTitle}*\n`;
  if (signal.eventTitle && signal.eventTitle !== signal.marketTitle) {
    message += `_🎯 ${signal.eventTitle}_\n`;
  }
  message += `\n`;

  message += `📊 *Outcome:* ${signal.outcome}\n`;
  message += `💰 *Current Price:* ${formatPrice(signal.currentPrice)}\n`;
  if (signal.targetPrice) {
    const change = ((signal.targetPrice - signal.currentPrice) / signal.currentPrice) * 100;
    message += `🎯 *Target Price:* ${formatPrice(signal.targetPrice)} (${change >= 0 ? "+" : ""}${change.toFixed(1)}%)\n`;
  }
  message += `\n`;

  message += `⭐ *Confidence:* ${signal.confidence}% ${confidenceStars}\n`;
  message += `📈 *24h Volume:* ${formatVolume(signal.volume24h)}\n`;
  message += `💧 *Liquidity:* ${formatVolume(signal.liquidity)}\n`;
  message += `↔️ *Spread:* ${(signal.spread * 100).toFixed(1)}%\n`;
  message += `⏰ *Time to Resolution:* ${timeText}\n`;
  message += `\n`;

  if (signal.factors.length > 0) {
    message += `*📌 Key Factors:*\n`;
    for (const factor of signal.factors) {
      message += `• ${factor}\n`;
    }
    message += `\n`;
  }

  message += `*📝 Analysis:*\n${signal.analysis}\n\n`;

  if (signal.marketUrl) {
    message += `[🔗 View Market](${signal.marketUrl})\n\n`;
  }

  message += `⚠️ _This is not financial advice. Prediction markets involve risk. Trade responsibly._`;

  try {
    const result = await bot.sendMessage(env.telegramChannelId, message, {
      parse_mode: "Markdown",
      link_preview_options: { is_disabled: true },
    });
    console.log(`[Telegram] Signal sent: ${result.message_id}`);
    return result.message_id.toString();
  } catch (err) {
    console.error("[Telegram] Failed to send message:", err);
    return null;
  }
}

export async function sendStatusUpdate(
  status: "started" | "scanning" | "paused" | "error",
  details?: string
): Promise<void> {
  const bot = getBot();
  if (!bot) return;

  const emojis: Record<string, string> = {
    started: "🟢",
    scanning: "🔍",
    paused: "⏸️",
    error: "❌",
  };

  const messages: Record<string, string> = {
    started: "*Bot Started* - Monitoring prediction markets for high-probability opportunities.",
    scanning: "*Scanning Markets* - Analyzing Polymarket and Kalshi for trading signals...",
    paused: "*Bot Paused* - Signal generation temporarily halted.",
    error: "*Bot Error* - An issue occurred. Check logs for details.",
  };

  const message = `${emojis[status]} ${messages[status]}\n\n${details || ""}`;

  try {
    await bot.sendMessage(env.telegramChannelId, message, {
      parse_mode: "Markdown",
    });
  } catch (err) {
    console.error("[Telegram] Failed to send status:", err);
  }
}

export async function sendSummary(
  scanCount: number,
  signalCount: number,
  platformBreakdown: { polymarket: number; kalshi: number }
): Promise<void> {
  const bot = getBot();
  if (!bot) return;

  const message =
    `📊 *Daily Scan Summary*\n\n` +
    `🔍 *Markets Scanned:* ${scanCount}\n` +
    `📈 *Signals Generated:* ${signalCount}\n\n` +
    `*Platform Breakdown:*\n` +
    `🔷 Polymarket: ${platformBreakdown.polymarket}\n` +
    `🟠 Kalshi: ${platformBreakdown.kalshi}\n\n` +
    `_Next scan in progress..._`;

  try {
    await bot.sendMessage(env.telegramChannelId, message, {
      parse_mode: "Markdown",
    });
  } catch (err) {
    console.error("[Telegram] Failed to send summary:", err);
  }
}
