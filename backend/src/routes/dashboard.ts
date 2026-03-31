import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { HonoAdapter } from "@bull-board/hono";
import { serveStatic } from "@hono/node-server/serve-static";
import type { Hono } from "hono";

import {
  createExportJobQueue,
  createFunctionalJobQueue,
  createImportJobQueue,
  createUpdateJobQueue,
} from "../job/index.js";

export function registerDashboardRoute(app: Hono): void {
  const serverAdapter = new HonoAdapter(serveStatic);
  const exportQueue = createExportJobQueue();
  const updateQueue = createUpdateJobQueue();
  const importQueue = createImportJobQueue();
  const functionalQueue = createFunctionalJobQueue();

  serverAdapter.setBasePath("/admin/queues");

  createBullBoard({
    queues: [
      new BullMQAdapter(exportQueue),
      new BullMQAdapter(updateQueue),
      new BullMQAdapter(importQueue),
      new BullMQAdapter(functionalQueue),
    ],
    serverAdapter,
  });

  app.route("/admin/queues", serverAdapter.registerPlugin());
}
