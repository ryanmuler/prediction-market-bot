/**
 * Bot Control Router
 * tRPC router for bot management and status
 */

import { createRouter, publicQuery } from "../middleware";
import { runBotScan, getBotStats } from "../services/bot";
import { getCronStatus } from "../lib/cron";

export const botRouter = createRouter({
  // Get bot status and stats
  status: publicQuery.query(() => {
    const stats = getBotStats();
    const cron = getCronStatus();

    return {
      ...stats,
      scheduler: cron,
    };
  }),

  // Trigger a manual scan
  scan: publicQuery.mutation(async () => {
    try {
      const result = await runBotScan();
      return {
        success: true,
        signalsGenerated: result.signalsGenerated,
        marketsScanned: result.marketsScanned,
        errors: result.errors,
      };
    } catch (err) {
      return {
        success: false,
        error: (err as Error).message,
        signalsGenerated: 0,
        marketsScanned: 0,
        errors: [(err as Error).message],
      };
    }
  }),
});
