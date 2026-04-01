import { Queue } from "bullmq";

import type { RedisConnectionOptions } from "../../../bullmq/index.js";

export const EXPORT_JOB_QUEUE_NAME = "job-export";
export const UPDATE_JOB_QUEUE_NAME = "job-update";
export const IMPORT_JOB_QUEUE_NAME = "job-import";

export function createQueueForJobKind(
  kind: "export" | "import" | "update",
  connection: RedisConnectionOptions,
): Queue<unknown> {
  switch (kind) {
    case "export":
      return createQueue(EXPORT_JOB_QUEUE_NAME, connection);
    case "import":
      return createQueue(IMPORT_JOB_QUEUE_NAME, connection);
    case "update":
      return createQueue(UPDATE_JOB_QUEUE_NAME, connection);
  }
}

function createQueue<TData>(
  name: string,
  connection: RedisConnectionOptions,
): Queue<TData> {
  return new Queue(name, {
    connection,
  });
}
