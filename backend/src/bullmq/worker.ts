import { Worker } from "bullmq";

import { createLogger } from "../logger/index.js";
import { PING_QUEUE_NAME, resolveRedisConnection } from "./config.js";

export function createPingWorker(): Worker {
  const logger = createLogger({
    component: "ping-worker",
    queue: PING_QUEUE_NAME,
  });
  const worker = new Worker(
    PING_QUEUE_NAME,
    async (job) => {
      await job.updateProgress(50);

      return {
        ok: true,
        queue: PING_QUEUE_NAME,
        jobId: job.id ?? null,
        payload: job.data,
      };
    },
    {
      connection: resolveRedisConnection(),
    },
  );

  worker.on("completed", (job) => {
    logger.info("ping job completed.", { runtimeJobId: job.id ?? null });
  });

  worker.on("failed", (job, error) => {
    logger.error("ping job failed.", {
      error,
      runtimeJobId: job?.id ?? null,
    });
  });

  return worker;
}
