import type { Kysely, Selectable } from "kysely";

import type { Result } from "../lib/result.js";
import { err, ok } from "../lib/result.js";
import type { GeshiDatabase, JobTable } from "./types.js";

export type CreateJobInput = {
  id: string;
  kind: string;
  retryable: boolean;
  sourceId: string | null;
};

export type JobListItem = {
  attemptCount: number;
  createdAt: Date;
  failureMessage: string | null;
  finishedAt: Date | null;
  id: string;
  kind: string;
  metadata: Record<string, unknown>;
  queueJobId: string | null;
  retryable: boolean;
  sourceId: string | null;
  startedAt: Date | null;
  status: "queued" | "running" | "succeeded" | "failed";
};

export type LatestObserveJob = {
  createdAt: Date;
  sourceId: string;
};

export type JobRepositoryError = Error;

export class JobRepository {
  public constructor(private readonly database: Kysely<GeshiDatabase>) {}

  public async createJob(
    input: CreateJobInput,
  ): Promise<Result<JobListItem, JobRepositoryError>> {
    try {
      const createdJob = await this.database
        .insertInto("jobs")
        .values({
          id: input.id,
          kind: input.kind,
          metadata: {},
          retryable: input.retryable,
          source_id: input.sourceId,
          status: "queued",
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      return ok(toJobListItem(createdJob));
    } catch (error) {
      return err(toRepositoryError(error, "Failed to create job."));
    }
  }

  public async attachQueueJobId(
    id: string,
    queueJobId: string | null,
  ): Promise<Result<void, JobRepositoryError>> {
    try {
      await this.database
        .updateTable("jobs")
        .set({
          queue_job_id: queueJobId,
        })
        .where("id", "=", id)
        .executeTakeFirstOrThrow();

      return ok(undefined);
    } catch (error) {
      return err(toRepositoryError(error, "Failed to attach queue job id."));
    }
  }

  public async markRunning(
    id: string,
  ): Promise<Result<void, JobRepositoryError>> {
    try {
      await this.database
        .updateTable("jobs")
        .set((expressionBuilder) => ({
          attempt_count: expressionBuilder("attempt_count", "+", 1),
          failure_message: null,
          finished_at: null,
          started_at: new Date(),
          status: "running",
        }))
        .where("id", "=", id)
        .executeTakeFirstOrThrow();

      return ok(undefined);
    } catch (error) {
      return err(toRepositoryError(error, "Failed to mark job running."));
    }
  }

  public async markSucceeded(
    id: string,
  ): Promise<Result<void, JobRepositoryError>> {
    try {
      await this.database
        .updateTable("jobs")
        .set({
          failure_message: null,
          finished_at: new Date(),
          status: "succeeded",
        })
        .where("id", "=", id)
        .executeTakeFirstOrThrow();

      return ok(undefined);
    } catch (error) {
      return err(toRepositoryError(error, "Failed to mark job succeeded."));
    }
  }

  public async markFailed(
    id: string,
    failureMessage: string,
    retryable: boolean,
  ): Promise<Result<void, JobRepositoryError>> {
    try {
      await this.database
        .updateTable("jobs")
        .set({
          failure_message: failureMessage,
          finished_at: new Date(),
          retryable,
          status: "failed",
        })
        .where("id", "=", id)
        .executeTakeFirstOrThrow();

      return ok(undefined);
    } catch (error) {
      return err(toRepositoryError(error, "Failed to mark job failed."));
    }
  }

  public async findJobById(id: string): Promise<JobListItem | null> {
    const job = await this.database
      .selectFrom("jobs")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return job === undefined ? null : toJobListItem(job);
  }

  public async replaceMetadata(
    id: string,
    metadata: Record<string, unknown>,
  ): Promise<Result<void, JobRepositoryError>> {
    try {
      await this.database
        .updateTable("jobs")
        .set({
          metadata,
        })
        .where("id", "=", id)
        .executeTakeFirstOrThrow();

      return ok(undefined);
    } catch (error) {
      return err(toRepositoryError(error, "Failed to replace job metadata."));
    }
  }

  public async getMetadata(
    id: string,
  ): Promise<Result<Record<string, unknown>, JobRepositoryError>> {
    try {
      const job = await this.database
        .selectFrom("jobs")
        .select(["metadata"])
        .where("id", "=", id)
        .executeTakeFirst();

      return ok(job?.metadata ?? {});
    } catch (error) {
      return err(toRepositoryError(error, "Failed to read job metadata."));
    }
  }

  public async listQueuedOrRunningObserveSourceIds(): Promise<
    Result<Set<string>, JobRepositoryError>
  > {
    try {
      const jobs = await this.database
        .selectFrom("jobs")
        .select(["source_id"])
        .where("kind", "=", "observe-source")
        .where("status", "in", ["queued", "running"])
        .where("source_id", "is not", null)
        .execute();

      return ok(
        new Set(
          jobs
            .map((job) => job.source_id)
            .filter((sourceId): sourceId is string => sourceId !== null),
        ),
      );
    } catch (error) {
      return err(
        toRepositoryError(
          error,
          "Failed to list queued or running observe source ids.",
        ),
      );
    }
  }

  public async findLatestObserveJobsBySourceIds(
    sourceIds: string[],
  ): Promise<Result<Map<string, LatestObserveJob>, JobRepositoryError>> {
    if (sourceIds.length === 0) {
      return ok(new Map());
    }

    try {
      const jobs = await this.database
        .selectFrom("jobs")
        .select(["created_at", "source_id"])
        .where("kind", "=", "observe-source")
        .where("source_id", "in", sourceIds)
        .orderBy("source_id", "asc")
        .orderBy("created_at", "desc")
        .execute();
      const latestJobsBySourceId = new Map<string, LatestObserveJob>();

      for (const job of jobs) {
        if (job.source_id === null || latestJobsBySourceId.has(job.source_id)) {
          continue;
        }

        latestJobsBySourceId.set(job.source_id, {
          createdAt: job.created_at,
          sourceId: job.source_id,
        });
      }

      return ok(latestJobsBySourceId);
    } catch (error) {
      return err(
        toRepositoryError(error, "Failed to find latest observe jobs."),
      );
    }
  }

  public async findQueuedOrRunningJobByKind(
    kind: string,
  ): Promise<JobListItem | null> {
    const job = await this.database
      .selectFrom("jobs")
      .selectAll()
      .where("kind", "=", kind)
      .where("status", "in", ["queued", "running"])
      .orderBy("created_at", "desc")
      .executeTakeFirst();

    return job === undefined ? null : toJobListItem(job);
  }
}

function toJobListItem(job: Selectable<JobTable>): JobListItem {
  return {
    attemptCount: job.attempt_count,
    createdAt: job.created_at,
    failureMessage: job.failure_message,
    finishedAt: job.finished_at,
    id: job.id,
    kind: job.kind,
    metadata: job.metadata,
    queueJobId: job.queue_job_id,
    retryable: job.retryable,
    sourceId: job.source_id,
    startedAt: job.started_at,
    status: job.status,
  };
}

function toRepositoryError(error: unknown, fallbackMessage: string): Error {
  return error instanceof Error ? error : new Error(fallbackMessage);
}
