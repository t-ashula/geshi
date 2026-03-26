import { Worker } from "bullmq";

import { PING_QUEUE_NAME, resolveRedisConnection } from "./config.js";

export function createPingWorker(): Worker {
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
    process.stdout.write(`Ping job completed: ${job.id ?? "unknown"}\n`);
  });

  worker.on("failed", (job, error) => {
    process.stderr.write(
      `Ping job failed: ${job?.id ?? "unknown"} ${String(error)}\n`,
    );
  });

  return worker;
}
