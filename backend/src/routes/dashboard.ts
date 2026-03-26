import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { HonoAdapter } from "@bull-board/hono";
import { serveStatic } from "@hono/node-server/serve-static";
import type { Hono } from "hono";

import { createPingQueue } from "../bullmq/index.js";

export function registerDashboardRoute(app: Hono): void {
  const serverAdapter = new HonoAdapter(serveStatic);
  const pingQueue = createPingQueue();

  serverAdapter.setBasePath("/admin/queues");

  createBullBoard({
    queues: [new BullMQAdapter(pingQueue)],
    serverAdapter,
  });

  app.route("/admin/queues", serverAdapter.registerPlugin());
}
