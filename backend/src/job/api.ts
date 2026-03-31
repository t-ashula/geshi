import { createUuidV7 } from "./id.js";
import type { JobStore } from "./store.js";
import type { Job, JobEvent, JobStatus } from "./type.js";

export type AppendJobEventRequest = {
  runtimeJobId?: string | null;
  occurredAt?: string;
  status?: string;
  failureStage?: string | null;
  note?: string | null;
};

export type CreateJobRequest = {
  kind?: string;
  payload?: unknown;
  runAfter?: string | null;
};

export interface JobApi {
  appendJobEvent(jobId: string, request: AppendJobEventRequest): Promise<JobEvent>;
  createJob(request: CreateJobRequest): Promise<Job>;
  getJob(jobId: string): Promise<Job>;
  listJobs(): Promise<Job[]>;
}

export class JobApiValidationError extends Error {}

export class JobNotFoundError extends Error {}

export function createJobApi(store: JobStore): JobApi {
  return {
    async createJob(request) {
      if (typeof request !== "object" || request === null || Array.isArray(request)) {
        throw new JobApiValidationError("request body must be an object.");
      }

      if (typeof request.kind !== "string" || request.kind.length === 0) {
        throw new JobApiValidationError("kind is required.");
      }

      if (!("payload" in request)) {
        throw new JobApiValidationError("payload is required.");
      }

      const runAfter = normalizeOptionalIsoDate(
        request.runAfter,
        "runAfter must be an ISO-8601 string.",
      );

      return store.createJob({
        createdAt: new Date().toISOString(),
        id: createUuidV7(),
        kind: request.kind,
        payload: request.payload,
        runAfter,
      });
    },

    async getJob(jobId) {
      const job = await store.getJob(jobId);

      if (job === null) {
        throw new JobNotFoundError("job not found.");
      }

      return job;
    },

    async listJobs() {
      return store.listJobs();
    },

    async appendJobEvent(jobId, request) {
      if (typeof request !== "object" || request === null || Array.isArray(request)) {
        throw new JobApiValidationError("request body must be an object.");
      }

      if (!isJobStatus(request.status)) {
        throw new JobApiValidationError("status is invalid.");
      }

      const runtimeJobId = normalizeNullableString(
        request.runtimeJobId,
        "runtimeJobId must be null or non-empty string.",
      );
      const failureStage = normalizeNullableString(
        request.failureStage,
        "failureStage must be null or non-empty string.",
      );
      const note = normalizeNullableText(
        request.note,
        "note must be null or string.",
      );
      const occurredAt = normalizeIsoDate(
        request.occurredAt ?? new Date().toISOString(),
        "occurredAt must be an ISO-8601 string.",
      );

      try {
        return await store.appendJobEvent({
          failureStage,
          jobId,
          note,
          occurredAt,
          runtimeJobId,
          status: request.status,
        });
      } catch (error) {
        if (isForeignKeyViolation(error)) {
          throw new JobNotFoundError("job not found.");
        }

        throw error;
      }
    },
  };
}

function isForeignKeyViolation(error: unknown): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23503"
  );
}

function isJobStatus(value: string | undefined): value is JobStatus {
  return (
    value === "registered" ||
    value === "scheduled" ||
    value === "queued" ||
    value === "running" ||
    value === "importing" ||
    value === "succeeded" ||
    value === "failed"
  );
}

function normalizeIsoDate(value: string, message: string): string {
  if (Number.isNaN(new Date(value).getTime())) {
    throw new JobApiValidationError(message);
  }

  return value;
}

function normalizeNullableString(
  value: string | null | undefined,
  message: string,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string" || value.length === 0) {
    throw new JobApiValidationError(message);
  }

  return value;
}

function normalizeNullableText(
  value: string | null | undefined,
  message: string,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new JobApiValidationError(message);
  }

  return value;
}

function normalizeOptionalIsoDate(
  value: string | null | undefined,
  message: string,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  return normalizeIsoDate(value, message);
}
