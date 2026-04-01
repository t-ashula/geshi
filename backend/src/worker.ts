import { Queue, Worker } from "bullmq";

import { resolveRedisConnection } from "./bullmq/index.js";
import {
  createExportJobWorker,
  createHealthCheckWorker,
  createImportJobWorker,
  createJobApi,
  createJobRuntime,
  createJobStore,
  createNoopImportInstructionHandler,
  createUpdateJobWorker,
  wrapFunctionalJobWorker,
} from "./job/index.js";
import { createLogger } from "./logger/index.js";

const HEALTH_CHECK_QUEUE_NAME = "job-health-check";

const redisConnection = resolveRedisConnection();
const runtime = createJobRuntime({
  kind: "bullmq",
  options: {
    connection: redisConnection,
  },
});
const api = createJobApi(createJobStore({ kind: "pg" }), runtime);
const healthCheckQueue = new Queue(HEALTH_CHECK_QUEUE_NAME, {
  connection: redisConnection,
});
const exportWorker = createExportJobWorker(
  api,
  {
    add(name, data) {
      switch (name) {
        case "healthCheck":
          return healthCheckQueue.add(name, data);
        default:
          throw new Error(`unsupported functional job kind: ${name}`);
      }
    },
  },
  redisConnection,
);
const updateWorker = createUpdateJobWorker(api, redisConnection);
const importWorker = createImportJobWorker(
  api,
  createNoopImportInstructionHandler(),
  redisConnection,
);
const healthCheckWorker = new Worker(
  HEALTH_CHECK_QUEUE_NAME,
  wrapFunctionalJobWorker(createHealthCheckWorker(), runtime),
  {
    connection: redisConnection,
  },
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

healthCheckWorker.on("ready", () => {
  logger.info("HealthCheck job worker ready.");
});
