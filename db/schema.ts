import {
  mysqlTable,
  serial,
  varchar,
  text,
  timestamp,
  decimal,
  int,
  json,
  boolean,
} from "drizzle-orm/mysql-core";

// Bot settings table
export const botSettings = mysqlTable("bot_settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

// Trading signals table
export const signals = mysqlTable("signals", {
  id: serial("id").primaryKey(),
  platform: varchar("platform", { length: 20 }).notNull(), // "polymarket" | "kalshi"
  signalType: varchar("signal_type", { length: 30 }).notNull(), // "BUY" | "SELL" | "ARBITRAGE" | "MOMENTUM"
  marketId: varchar("market_id", { length: 255 }).notNull(),
  marketTitle: text("market_title").notNull(),
  eventTitle: text("event_title"),
  outcome: varchar("outcome", { length: 100 }),
  currentPrice: decimal("current_price", { precision: 10, scale: 4 }).notNull(),
  targetPrice: decimal("target_price", { precision: 10, scale: 4 }),
  confidence: int("confidence").notNull(), // 0-100
  volume24h: decimal("volume_24h", { precision: 20, scale: 4 }),
  liquidity: decimal("liquidity", { precision: 20, scale: 4 }),
  spread: decimal("spread", { precision: 10, scale: 4 }),
  timeToResolution: int("time_to_resolution"), // hours until resolution
  analysis: text("analysis"),
  factors: json("factors").$type<string[]>(),
  telegramMessageId: varchar("telegram_message_id", { length: 100 }),
  sentToTelegram: boolean("sent_to_telegram").notNull().default(false),
  status: varchar("status", { length: 20 }).notNull().default("active"), // "active" | "expired" | "resolved" | "invalidated"
  result: varchar("result", { length: 20 }), // "win" | "loss" | "pending"
  actualOutcome: varchar("actual_outcome", { length: 100 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

// Market snapshots for tracking historical data
export const marketSnapshots = mysqlTable("market_snapshots", {
  id: serial("id").primaryKey(),
  platform: varchar("platform", { length: 20 }).notNull(),
  marketId: varchar("market_id", { length: 255 }).notNull(),
  marketTitle: text("market_title"),
  price: decimal("price", { precision: 10, scale: 4 }).notNull(),
  volume24h: decimal("volume_24h", { precision: 20, scale: 4 }),
  liquidity: decimal("liquidity", { precision: 20, scale: 4 }),
  spread: decimal("spread", { precision: 10, scale: 4 }),
  openInterest: decimal("open_interest", { precision: 20, scale: 4 }),
  uniqueTraders: int("unique_traders"),
  capturedAt: timestamp("captured_at").notNull().defaultNow(),
});

// Bot activity log
export const botLogs = mysqlTable("bot_logs", {
  id: serial("id").primaryKey(),
  level: varchar("level", { length: 20 }).notNull(), // "info" | "warn" | "error" | "signal"
  message: text("message").notNull(),
  details: json("details"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Signal performance tracking
export const signalPerformance = mysqlTable("signal_performance", {
  id: serial("id").primaryKey(),
  signalId: int("signal_id").notNull(),
  platform: varchar("platform", { length: 20 }).notNull(),
  signalType: varchar("signal_type", { length: 30 }).notNull(),
  entryPrice: decimal("entry_price", { precision: 10, scale: 4 }).notNull(),
  exitPrice: decimal("exit_price", { precision: 10, scale: 4 }),
  pnl: decimal("pnl", { precision: 10, scale: 4 }),
  roi: decimal("roi", { precision: 10, scale: 4 }),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
