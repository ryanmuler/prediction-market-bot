import { createRouter, publicQuery } from "./middleware";
import { signalsRouter } from "./routers/signals";
import { botRouter } from "./routers/bot";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),

  signals: signalsRouter,
  bot: botRouter,
});

export type AppRouter = typeof appRouter;
