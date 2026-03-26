export type Job = {
  id: string;
  kind: string;
  target: JobTarget | null;
  payload: unknown;
  createdAt: string;
  runAfter: string | null;
};

export type JobEvent = {
  jobId: string;
  runtimeJobId: string | null;
  occurredAt: string;
  status: JobStatus;
  note: string;
};

export type JobStatus =
  | "registered"
  | "scheduled"
  | "queued"
  | "running"
  | "cancelling"
  | "succeeded"
  | "failed"
  | "cancelled";

export type JobTarget = {
  resourceType: string;
  resourceId: string;
};
