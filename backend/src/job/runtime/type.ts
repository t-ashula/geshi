import type { JobStatus } from "../type.js";

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
