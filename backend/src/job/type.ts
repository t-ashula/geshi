export type Job = {
  id: string;
  kind: string;
  payload: unknown;
  createdAt: string;
  runAfter: string | null;
  status: JobStatus | null;
  failureStage: string | null;
  occurredAt: string | null;
  note: string | null;
};

export type JobEvent = {
  id: string;
  jobId: string;
  runtimeJobId: string | null;
  occurredAt: string;
  status: JobStatus;
  failureStage: string | null;
  note: string | null;
};

export type JobStatus =
  | "registered"
  | "scheduled"
  | "queued"
  | "running"
  | "importing"
  | "succeeded"
  | "failed";
