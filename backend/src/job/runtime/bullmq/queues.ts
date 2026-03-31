import { Queue } from "bullmq";

import { resolveRedisConnection } from "../../../bullmq/index.js";
import type {
  ExportJobInput,
  FunctionalJobData,
  ImportJobInput,
  UpdateJobInput,
} from "../type.js";

export const EXPORT_JOB_QUEUE_NAME = "job-export";
export const UPDATE_JOB_QUEUE_NAME = "job-update";
export const IMPORT_JOB_QUEUE_NAME = "job-import";
export const FUNCTIONAL_JOB_QUEUE_NAME = "job-functional";

export function createExportJobQueue(): Queue<ExportJobInput> {
  return new Queue(EXPORT_JOB_QUEUE_NAME, {
    connection: resolveRedisConnection(),
  });
}

export function createFunctionalJobQueue(): Queue<FunctionalJobData> {
  return new Queue(FUNCTIONAL_JOB_QUEUE_NAME, {
    connection: resolveRedisConnection(),
  });
}

export function createImportJobQueue(): Queue<ImportJobInput> {
  return new Queue(IMPORT_JOB_QUEUE_NAME, {
    connection: resolveRedisConnection(),
  });
}

export function createUpdateJobQueue(): Queue<UpdateJobInput> {
  return new Queue(UPDATE_JOB_QUEUE_NAME, {
    connection: resolveRedisConnection(),
  });
}
