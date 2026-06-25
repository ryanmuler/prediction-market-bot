/**
 * Signals Router
 * tRPC router for signal history and market data queries
 */

import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { signals, marketSnapshots, botLogs } from "@db/schema";
import { desc, eq, and, gte, sql } from "drizzle-orm";

export const signalsRouter = createRouter({
  // Get recent signals with pagination
  list: publicQuery
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        platform: z.string().optional(),
        signalType: z.string().optional(),
        status: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];

      if (input.platform) {
        conditions.push(eq(signals.platform, input.platform));
      }
      if (input.signalType) {
        conditions.push(eq(signals.signalType, input.signalType));
      }
      if (input.status) {
        conditions.push(eq(signals.status, input.status));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const items = await db
        .select()
        .from(signals)
        .where(where)
        .orderBy(desc(signals.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(signals)
        .where(where);

      return {
        items,
        total: Number(countResult[0]?.count || 0),
      };
    }),

  // Get signal by ID
  getById: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const result = await db
        .select()
        .from(signals)
        .where(eq(signals.id, input.id))
        .limit(1);
      return result[0] || null;
    }),

  // Get signal statistics
  stats: publicQuery.query(async () => {
    const db = getDb();

    const total = await db
      .select({ count: sql<number>`count(*)` })
      .from(signals);

    const platformBreakdown = await db
      .select({
        platform: signals.platform,
        count: sql<number>`count(*)`,
      })
      .from(signals)
      .groupBy(signals.platform);

    const typeBreakdown = await db
      .select({
        signalType: signals.signalType,
        count: sql<number>`count(*)`,
      })
      .from(signals)
      .groupBy(signals.signalType);

    const statusBreakdown = await db
      .select({
        status: signals.status,
        count: sql<number>`count(*)`,
      })
      .from(signals)
      .groupBy(signals.status);

    const avgConfidence = await db
      .select({
        avg: sql<number>`avg(${signals.confidence})`,
      })
      .from(signals);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaySignals = await db
      .select({ count: sql<number>`count(*)` })
      .from(signals)
      .where(gte(signals.createdAt, today));

    return {
      total: Number(total[0]?.count || 0),
      today: Number(todaySignals[0]?.count || 0),
      avgConfidence: Math.round(Number(avgConfidence[0]?.avg || 0)),
      byPlatform: platformBreakdown,
      byType: typeBreakdown,
      byStatus: statusBreakdown,
    };
  }),

  // Get market snapshots for a specific market
  snapshots: publicQuery
    .input(
      z.object({
        marketId: z.string(),
        platform: z.string(),
        limit: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      return db
        .select()
        .from(marketSnapshots)
        .where(
          and(
            eq(marketSnapshots.marketId, input.marketId),
            eq(marketSnapshots.platform, input.platform)
          )
        )
        .orderBy(desc(marketSnapshots.capturedAt))
        .limit(input.limit);
    }),

  // Get bot logs
  logs: publicQuery
    .input(
      z.object({
        limit: z.number().min(1).max(200).default(50),
        level: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      const where = input.level ? eq(botLogs.level, input.level) : undefined;
      return db
        .select()
        .from(botLogs)
        .where(where)
        .orderBy(desc(botLogs.createdAt))
        .limit(input.limit);
    }),
});
