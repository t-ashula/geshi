import type {
  CreateBullmqJobRuntimeOptions,
  JobRuntime,
} from "../type.js";
import { createQueueForJobKind } from "./queues.js";

export function createBullmqRuntime(
  options: CreateBullmqJobRuntimeOptions,
): JobRuntime {
  const { connection } = options;
  const queues = {
    export: createQueueForJobKind("export", connection),
    import: createQueueForJobKind("import", connection),
    update: createQueueForJobKind("update", connection),
  };

  return {
    async addJob(job) {
      await queues[job.kind].add(job.kind, job.payload);
    },
  };
}
