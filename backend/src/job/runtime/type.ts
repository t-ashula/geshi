import type { RedisConnectionOptions } from "../../bullmq/index.js";
import type { JobStatus } from "../type.js";

export type CreateBullmqJobRuntimeOptions = {
  connection: RedisConnectionOptions;
};

export type CreateJobRuntimeInput = {
  kind: "bullmq";
  options: CreateBullmqJobRuntimeOptions;
};

export type ExportJobInput = {
  jobId: string;
};

export type FunctionalJobContext = {
  jobId: string;
};

export type FunctionalJobData<TPayload = unknown> = {
  context: FunctionalJobContext;
  payload: TPayload;
};

export type FunctionalJobOutput = {
  importInstructions: ImportInstruction[] | null;
  note?: string | null;
};

export type ImportInstruction = {
  operation: string;
  payload: string;
};

export type ImportJobInput = {
  result: RuntimeJobResult;
  importInstructions: ImportInstruction[] | null;
};

export interface JobRuntime {
  addJob(job: JobRuntimeJob): Promise<void>;
}

export type JobRuntimeJob =
  | { kind: "export"; payload: ExportJobInput }
  | { kind: "import"; payload: ImportJobInput }
  | { kind: "update"; payload: UpdateJobInput };

export type RuntimeJobResult = {
  jobId: string;
  jobStatus: "succeeded" | "failed";
  failureStage: string | null;
  note: string | null;
};

export type UpdateJobInput = {
  jobId: string;
  runtimeJobId: string | null;
  occurredAt: string;
  status: JobStatus;
  failureStage: string | null;
  note: string | null;
};
