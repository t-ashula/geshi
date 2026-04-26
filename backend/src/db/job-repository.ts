import type { Kysely, Selectable } from "kysely";

import type { GeshiDatabase, JobTable } from "./types.js";

export type CreateJobInput = {
  id: string;
  kind: string;
  retryable: boolean;
  sourceId: string;
};

export type JobListItem = {
  attemptCount: number;
  createdAt: Date;
  failureMessage: string | null;
  finishedAt: Date | null;
  id: string;
  kind: string;
  queueJobId: string | null;
  retryable: boolean;
  sourceId: string | null;
  startedAt: Date | null;
  status: "queued" | "running" | "succeeded" | "failed";
};

export class JobRepository {
  public constructor(private readonly database: Kysely<GeshiDatabase>) {}

  public async createJob(input: CreateJobInput): Promise<JobListItem> {
    const createdJob = await this.database
      .insertInto("jobs")
      .values({
        id: input.id,
        kind: input.kind,
        retryable: input.retryable,
        source_id: input.sourceId,
        status: "queued",
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toJobListItem(createdJob);
  }

  public async attachQueueJobId(
    id: string,
    queueJobId: string | null,
  ): Promise<void> {
    await this.database
      .updateTable("jobs")
      .set({
        queue_job_id: queueJobId,
      })
      .where("id", "=", id)
      .executeTakeFirstOrThrow();
  }

  public async markRunning(id: string): Promise<void> {
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
  }

  public async markSucceeded(id: string): Promise<void> {
    await this.database
      .updateTable("jobs")
      .set({
        failure_message: null,
        finished_at: new Date(),
        status: "succeeded",
      })
      .where("id", "=", id)
      .executeTakeFirstOrThrow();
  }

  public async markFailed(
    id: string,
    failureMessage: string,
    retryable: boolean,
  ): Promise<void> {
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
  }

  public async findJobById(id: string): Promise<JobListItem | null> {
    const job = await this.database
      .selectFrom("jobs")
      .selectAll()
      .where("id", "=", id)
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
    queueJobId: job.queue_job_id,
    retryable: job.retryable,
    sourceId: job.source_id,
    startedAt: job.started_at,
    status: job.status,
  };
}
