import { getPool } from "./db/index.js";
import {
  createExportJobWorker,
  createFunctionalJobQueue,
  createImportJobWorker,
  createJobApi,
  createJobStore,
  createNoopImportInstructionHandler,
  createUpdateJobWorker,
} from "./job/index.js";
import { createLogger } from "./logger/index.js";

const api = createJobApi(createJobStore(getPool()));
const exportWorker = createExportJobWorker(api, createFunctionalJobQueue());
const updateWorker = createUpdateJobWorker(api);
const importWorker = createImportJobWorker(api, createNoopImportInstructionHandler());
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
