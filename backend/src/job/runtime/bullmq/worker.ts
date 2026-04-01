import { Worker } from "bullmq";

import { resolveRedisConnection } from "../../../bullmq/index.js";
import type { JobApi } from "../../api.js";
import type {
  FunctionalJobData,
  FunctionalJobOutput,
  ImportJobInput,
  JobRuntime,
} from "../type.js";
import { EXPORT_JOB_QUEUE_NAME, IMPORT_JOB_QUEUE_NAME, UPDATE_JOB_QUEUE_NAME } from "./queues.js";

export type ImportInstructionHandler = (
  operation: string,
  payload: string,
) => Promise<void>;

type RuntimeJobQueue = {
  add(name: string, data: FunctionalJobData): Promise<{ id?: string }>;
};

export function createExportJobWorker(
  api: JobApi,
  runtimeQueue: RuntimeJobQueue,
  connection = resolveRedisConnection(),
): Worker<{ jobId: string }> {
  return new Worker(
    EXPORT_JOB_QUEUE_NAME,
    async (job) => {
      await runExportJob(api, runtimeQueue, job.data);
    },
    {
      connection,
    },
  );
}

export function createImportJobWorker(
  api: JobApi,
  applyInstruction: ImportInstructionHandler,
  connection = resolveRedisConnection(),
): Worker<ImportJobInput> {
  return new Worker(
    IMPORT_JOB_QUEUE_NAME,
    async (job) => {
      await runImportJob(api, applyInstruction, job.data);
    },
    {
      connection,
    },
  );
}

export function createNoopImportInstructionHandler(): ImportInstructionHandler {
  return async () => {};
}

export function createUpdateJobWorker(
  api: JobApi,
  connection = resolveRedisConnection(),
): Worker<{
  jobId: string;
  runtimeJobId: string | null;
  occurredAt: string;
  status: "running" | "scheduled" | "queued";
  failureStage: string | null;
  note: string | null;
}> {
  return new Worker(
    UPDATE_JOB_QUEUE_NAME,
    async (job) => {
      await runUpdateJob(api, job.data);
    },
    {
      connection,
    },
  );
}

export async function runExportJob(
  api: JobApi,
  runtimeQueue: RuntimeJobQueue,
  input: { jobId: string },
  now = new Date(),
): Promise<void> {
  const job = await api.getJob(input.jobId);

  if (job.status !== "registered") {
    return;
  }

  const occurredAt = now.toISOString();

  if (job.runAfter !== null && new Date(job.runAfter).getTime() > now.getTime()) {
    await api.appendJobEvent(job.id, {
      occurredAt,
      status: "scheduled",
    });

    return;
  }

  const runtimeJob = await runtimeQueue.add(job.kind, {
    context: {
      jobId: job.id,
    },
    payload: job.payload,
  });

  await api.appendJobEvent(job.id, {
    occurredAt,
    runtimeJobId: runtimeJob.id ?? null,
    status: "queued",
  });
}

export async function runImportJob(
  api: JobApi,
  applyInstruction: ImportInstructionHandler,
  input: ImportJobInput,
  now = new Date(),
): Promise<void> {
  const occurredAt = now.toISOString();

  await api.appendJobEvent(input.result.jobId, {
    occurredAt,
    status: "importing",
  });

  try {
    if (input.result.jobStatus === "succeeded") {
      for (const instruction of input.importInstructions ?? []) {
        await applyInstruction(instruction.operation, instruction.payload);
      }
    }

    await api.appendJobEvent(input.result.jobId, {
      failureStage: input.result.failureStage,
      note: input.result.note,
      occurredAt: new Date().toISOString(),
      status: input.result.jobStatus,
    });
  } catch (error) {
    await api.appendJobEvent(input.result.jobId, {
      occurredAt: new Date().toISOString(),
      failureStage: "import",
      note: error instanceof Error ? error.message : null,
      status: "failed",
    });

    throw error;
  }
}

export async function runUpdateJob(
  api: JobApi,
  input: {
    jobId: string;
    runtimeJobId: string | null;
    occurredAt: string;
    status: "running" | "scheduled" | "queued";
    failureStage: string | null;
    note: string | null;
  },
): Promise<void> {
  await api.appendJobEvent(input.jobId, input);
}

export function wrapFunctionalJobWorker<TPayload>(
  realWorker: (
    context: { jobId: string },
    payload: TPayload,
  ) => Promise<FunctionalJobOutput>,
  runtime: JobRuntime,
) {
  return async (job: {
    id?: string;
    data: FunctionalJobData<TPayload>;
  }): Promise<FunctionalJobOutput> => {
    const occurredAt = new Date().toISOString();

    await runtime.addJob({
      kind: "update",
      payload: {
        failureStage: null,
        jobId: job.data.context.jobId,
        note: null,
        occurredAt,
        runtimeJobId: job.id ?? null,
        status: "running",
      },
    });

    try {
      const output = await realWorker(job.data.context, job.data.payload);

      await runtime.addJob({
        kind: "import",
        payload: {
          importInstructions: output.importInstructions,
          result: {
            failureStage: null,
            jobId: job.data.context.jobId,
            jobStatus: "succeeded",
            note: output.note ?? null,
          },
        },
      });

      return output;
    } catch (error) {
      await runtime.addJob({
        kind: "import",
        payload: {
          importInstructions: null,
          result: {
            failureStage: "runtime",
            jobId: job.data.context.jobId,
            jobStatus: "failed",
            note: error instanceof Error ? error.message : null,
          },
        },
      });

      throw error;
    }
  };
}
