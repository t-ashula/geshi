import { Queue } from "bullmq";

import { resolveRedisConnection } from "./bullmq/index.js";
import {
  createExportJobWorker,
  createImportJobWorker,
  createJobApi,
  createJobRuntime,
  createJobStore,
  createNoopImportInstructionHandler,
  createUpdateJobWorker,
} from "./job/index.js";
import { createLogger } from "./logger/index.js";

const redisConnection = resolveRedisConnection();
const api = createJobApi(
  createJobStore({ kind: "pg" }),
  createJobRuntime({
    kind: "bullmq",
    options: {
      connection: redisConnection,
    },
  }),
);
const exportWorker = createExportJobWorker(
  api,
  new Queue("job-functional", {
    connection: redisConnection,
  }),
);
const updateWorker = createUpdateJobWorker(api);
const importWorker = createImportJobWorker(
  api,
  createNoopImportInstructionHandler(),
);
const logger = createLogger({ component: "job-runtime-worker" });

exportWorker.on("ready", () => {
  logger.info("export job worker ready.");
});

updateWorker.on("ready", () => {
  logger.info("update job worker ready.");
});

importWorker.on("ready", () => {
  logger.info("import job worker ready.");
});
