import type { Hono } from "hono";

import { createPingQueue } from "../bullmq/index.js";

export function registerJobRoutes(app: Hono): void {
  app.post("/dev/jobs/ping", async (context) => {
    const queue = createPingQueue();

    try {
      const job = await queue.add("ping", {
        requestedAt: new Date().toISOString(),
      });

      return context.json(
        {
          ok: true,
          queue: queue.name,
          jobId: job.id,
        },
        202,
      );
    } finally {
      await queue.close();
    }
  });
}
