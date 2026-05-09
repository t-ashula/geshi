import type { Kysely, Selectable } from "kysely";
import { sql } from "kysely";

import type { Result } from "../lib/result.js";
import { err, ok } from "../lib/result.js";
import type { GeshiDatabase, JobTable } from "./types.js";

export type CreateJobInput = {
  id: string;
  kind: string;
  metadata?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  retryable: boolean;
};

export type JobStatus =
  | "planned"
  | "queued"
  | "running"
  | "succeeded"
  | "failed";

export type JobListItem = {
  attemptCount: number;
  createdAt: Date;
  failureMessage: string | null;
  finishedAt: Date | null;
  id: string;
  kind: string;
  metadata: Record<string, unknown>;
  payload: Record<string, unknown>;
  queueJobId: string | null;
  retryable: boolean;
  startedAt: Date | null;
  status: JobStatus;
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
          metadata: input.metadata ?? {},
          payload: input.payload ?? {},
          retryable: input.retryable,
          status: "planned",
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
          status: queueJobId === null ? "planned" : "queued",
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

  public async listIncompleteObserveSourceIds(): Promise<
    Result<Set<string>, JobRepositoryError>
  > {
    try {
      const jobs = await this.database
        .selectFrom("jobs")
        .select(
          sql<string | null>`jobs.payload -> 'source' ->> 'id'`.as("source_id"),
        )
        .where("kind", "=", "observe-source")
        .where("status", "in", ["planned", "queued", "running"])
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
          "Failed to list incomplete observe source ids.",
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
        .select([
          "created_at",
          sql<string | null>`jobs.payload -> 'source' ->> 'id'`.as("source_id"),
        ])
        .where("kind", "=", "observe-source")
        .where(
          sql<string | null>`jobs.payload -> 'source' ->> 'id'`,
          "in",
          sourceIds,
        )
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

  public async findIncompleteJobByKind(
    kind: string,
  ): Promise<JobListItem | null> {
    const job = await this.database
      .selectFrom("jobs")
      .selectAll()
      .where("kind", "=", kind)
      .where("status", "in", ["planned", "queued", "running"])
      .orderBy("created_at", "desc")
      .executeTakeFirst();

    return job === undefined ? null : toJobListItem(job);
  }

  public async listPlannedJobsByKind(
    kind: string,
  ): Promise<Result<JobListItem[], JobRepositoryError>> {
    try {
      const jobs = await this.database
        .selectFrom("jobs")
        .selectAll()
        .where("kind", "=", kind)
        .where((expressionBuilder) =>
          expressionBuilder.or([
            expressionBuilder("status", "=", "planned"),
            expressionBuilder.and([
              expressionBuilder("status", "=", "queued"),
              expressionBuilder("queue_job_id", "is", null),
            ]),
          ]),
        )
        .orderBy("created_at", "asc")
        .execute();

      return ok(jobs.map(toJobListItem));
    } catch (error) {
      return err(toRepositoryError(error, "Failed to list planned jobs."));
    }
  }

  public async listIncompleteRecordContentAssetIds(): Promise<
    Result<Set<string>, JobRepositoryError>
  > {
    return this.listRecordContentAssetIdsByStatuses([
      "planned",
      "queued",
      "running",
    ]);
  }

  public async listRunningRecordContentAssetIds(): Promise<
    Result<Set<string>, JobRepositoryError>
  > {
    return this.listRecordContentAssetIdsByStatuses(["running"]);
  }

  private async listRecordContentAssetIdsByStatuses(
    statuses: Array<"planned" | "queued" | "running">,
  ): Promise<Result<Set<string>, JobRepositoryError>> {
    try {
      const rows = await this.database
        .selectFrom("jobs")
        .select(
          sql<string | null>`jobs.payload -> 'asset' ->> 'id'`.as("asset_id"),
        )
        .where("kind", "=", "record-content")
        .where("status", "in", statuses)
        .execute();

      return ok(
        new Set(
          rows
            .map((row) => row.asset_id)
            .filter((assetId): assetId is string => assetId !== null),
        ),
      );
    } catch (error) {
      return err(
        toRepositoryError(
          error,
          "Failed to list record-content asset ids by status.",
        ),
      );
    }
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
    payload: job.payload,
    queueJobId: job.queue_job_id,
    retryable: job.retryable,
    startedAt: job.started_at,
    status: job.status,
  };
}

function toRepositoryError(error: unknown, fallbackMessage: string): Error {
  return error instanceof Error ? error : new Error(fallbackMessage);
}
