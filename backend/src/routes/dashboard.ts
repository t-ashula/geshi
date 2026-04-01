import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { HonoAdapter } from "@bull-board/hono";
import { serveStatic } from "@hono/node-server/serve-static";
import type { Hono } from "hono";

import { resolveRedisConnection } from "../bullmq/index.js";
import { createQueueForJobKind } from "../job/runtime/bullmq/index.js";

export function registerDashboardRoute(app: Hono): void {
  const serverAdapter = new HonoAdapter(serveStatic);
  const connection = resolveRedisConnection();
  const exportQueue = createQueueForJobKind("export", connection);
  const updateQueue = createQueueForJobKind("update", connection);
  const importQueue = createQueueForJobKind("import", connection);

  serverAdapter.setBasePath("/admin/queues");

  createBullBoard({
    queues: [
      new BullMQAdapter(exportQueue),
      new BullMQAdapter(updateQueue),
      new BullMQAdapter(importQueue),
    ],
    serverAdapter,
  });

  app.route("/admin/queues", serverAdapter.registerPlugin());
}
