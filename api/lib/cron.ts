/**
 * Cron Scheduler for the Prediction Market Bot
 * Runs scans at regular intervals
 */

import { schedule } from "node-cron";
import { runBotScan, getBotStats } from "../services/bot";
import { sendStatusUpdate } from "../clients/telegram";

let scanJob: ReturnType<typeof schedule> | null = null;

// Default: scan every 30 minutes
const DEFAULT_CRON = "*/30 * * * *";

export function startCron(cronExpression: string = DEFAULT_CRON): void {
  if (scanJob) {
    console.log("[Cron] Stopping existing job before starting new one");
    scanJob.stop();
  }

  console.log(`[Cron] Starting bot with schedule: ${cronExpression}`);

  // Send startup notification
  sendStatusUpdate("started", `Scan schedule: Every ${cronExpression}`).catch(console.error);

  // Run initial scan after 10 seconds
  setTimeout(() => {
    console.log("[Cron] Running initial scan...");
    runBotScan().catch(console.error);
  }, 10000);

  // Schedule recurring scans
  scanJob = schedule(cronExpression, async () => {
    const stats = getBotStats();
    if (stats.isRunning) {
      console.log("[Cron] Scan already in progress, skipping scheduled run");
      return;
    }

    console.log(`[Cron] Running scheduled scan at ${new Date().toISOString()}`);
    try {
      const result = await runBotScan();
      console.log(
        `[Cron] Scan complete: ${result.signalsGenerated} signals, ${result.errors.length} errors`
      );
    } catch (err) {
      console.error("[Cron] Scheduled scan failed:", err);
    }
  });

  console.log("[Cron] Bot scheduler started successfully");
}

export function stopCron(): void {
  if (scanJob) {
    scanJob.stop();
    scanJob = null;
    console.log("[Cron] Bot scheduler stopped");
    sendStatusUpdate("paused").catch(console.error);
  }
}

export function getCronStatus(): {
  running: boolean;
  schedule: string | null;
  nextRun: string | null;
} {
  if (!scanJob) {
    return { running: false, schedule: null, nextRun: null };
  }

  // Get next run info from the underlying cron
  return {
    running: true,
    schedule: DEFAULT_CRON,
    nextRun: null, // node-cron doesn't expose next run time easily
  };
}
