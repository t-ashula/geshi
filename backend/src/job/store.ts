import type { PoolClient } from "pg";
import { Pool } from "pg";

import { createUuidV7 } from "./id.js";
import type { Job, JobEvent, JobStatus } from "./type.js";

export type AppendJobEventInput = {
  jobId: string;
  runtimeJobId: string | null;
  occurredAt: string;
  status: JobStatus;
  failureStage: string | null;
  note: string | null;
};

export type CreateJobInput = {
  id: string;
  kind: string;
  payload: unknown;
  createdAt: string;
  runAfter: string | null;
};

export type CreateJobStoreInput = {
  kind: "pg";
  options?: {
    databaseUrl?: string;
    searchPath?: string;
  };
};

export interface JobStore {
  appendJobEvent(input: AppendJobEventInput): Promise<JobEvent>;
  createJob(input: CreateJobInput): Promise<Job>;
  getJob(jobId: string): Promise<Job | null>;
  listJobs(): Promise<Job[]>;
}

type DbJobEventRow = {
  id: string;
  job_id: string;
  runtime_job_id: string | null;
  occurred_at: Date;
  status: string;
  failure_stage: string | null;
  note: string | null;
};

type DbJobRow = {
  id: string;
  kind: string;
  payload: unknown;
  created_at: Date;
  run_after: Date | null;
};

type DbJobWithStateRow = DbJobRow & {
  current_status: string | null;
  current_failure_stage: string | null;
  current_occurred_at: Date | null;
  current_note: string | null;
};

let defaultJobStore: JobStore | null = null;

class PgJobStore implements JobStore {
  public constructor(private readonly pool: Pool) {}

  public async createJob(input: CreateJobInput): Promise<Job> {
    const client = await this.pool.connect();

    try {
      await client.query("begin");
      const job = await this.insertJob(client, input);
      const event = await this.insertJobEvent(client, {
        failureStage: null,
        jobId: input.id,
        note: null,
        occurredAt: input.createdAt,
        runtimeJobId: null,
        status: "registered",
      });
      await client.query("commit");

      return withCurrentState(job, event);
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  public async appendJobEvent(input: AppendJobEventInput): Promise<JobEvent> {
    const result = await this.pool.query<DbJobEventRow>(
      `
        insert into job_events (
          id,
          job_id,
          runtime_job_id,
          occurred_at,
          status,
          failure_stage,
          note
        )
        values ($1, $2, $3, $4, $5, $6, $7)
        returning
          id,
          job_id,
          runtime_job_id,
          occurred_at,
          status,
          failure_stage,
          note
      `,
      [
        createUuidV7(),
        input.jobId,
        input.runtimeJobId,
        input.occurredAt,
        input.status,
        input.failureStage,
        input.note,
      ],
    );

    return toJobEvent(result.rows[0]);
  }

  public async getJob(jobId: string): Promise<Job | null> {
    const result = await this.pool.query<DbJobWithStateRow>(
      `
        select
          jobs.id,
          jobs.kind,
          jobs.payload,
          jobs.created_at,
          jobs.run_after,
          latest.status as current_status,
          latest.failure_stage as current_failure_stage,
          latest.occurred_at as current_occurred_at,
          latest.note as current_note
        from jobs
        left join lateral (
          select
            status,
            failure_stage,
            occurred_at,
            note
          from job_events
          where job_events.job_id = jobs.id
          order by occurred_at desc, id desc
          limit 1
        ) latest on true
        where jobs.id = $1
      `,
      [jobId],
    );

    const row = result.rows[0];

    if (row === undefined) {
      return null;
    }

    return toJobWithCurrentState(row);
  }

  public async listJobs(): Promise<Job[]> {
    const result = await this.pool.query<DbJobWithStateRow>(
      `
        select
          jobs.id,
          jobs.kind,
          jobs.payload,
          jobs.created_at,
          jobs.run_after,
          latest.status as current_status,
          latest.failure_stage as current_failure_stage,
          latest.occurred_at as current_occurred_at,
          latest.note as current_note
        from jobs
        left join lateral (
          select
            status,
            failure_stage,
            occurred_at,
            note
          from job_events
          where job_events.job_id = jobs.id
          order by occurred_at desc, id desc
          limit 1
        ) latest on true
        order by jobs.created_at desc, jobs.id desc
      `,
    );

    return result.rows.map((row) => toJobWithCurrentState(row));
  }

  private async insertJob(
    client: PoolClient,
    input: CreateJobInput,
  ): Promise<Job> {
    const result = await client.query<DbJobRow>(
      `
        insert into jobs (
          id,
          kind,
          payload,
          created_at,
          run_after
        )
        values ($1, $2, $3, $4, $5)
        returning
          id,
          kind,
          payload,
          created_at,
          run_after
      `,
      [input.id, input.kind, input.payload, input.createdAt, input.runAfter],
    );

    return toJob(result.rows[0]);
  }

  private async insertJobEvent(
    client: PoolClient,
    input: AppendJobEventInput,
  ): Promise<JobEvent> {
    const result = await client.query<DbJobEventRow>(
      `
        insert into job_events (
          id,
          job_id,
          runtime_job_id,
          occurred_at,
          status,
          failure_stage,
          note
        )
        values ($1, $2, $3, $4, $5, $6, $7)
        returning
          id,
          job_id,
          runtime_job_id,
          occurred_at,
          status,
          failure_stage,
          note
      `,
      [
        createUuidV7(),
        input.jobId,
        input.runtimeJobId,
        input.occurredAt,
        input.status,
        input.failureStage,
        input.note,
      ],
    );

    return toJobEvent(result.rows[0]);
  }
}

export function createJobStore(input: CreateJobStoreInput): JobStore {
  if (input.kind !== "pg") {
    throw new Error(`Unsupported job store kind: ${String(input)}`);
  }

  const options = input.options;

  if (options === undefined) {
    if (defaultJobStore !== null) {
      return defaultJobStore;
    }

    defaultJobStore = new PgJobStore(createPgPool({}));

    return defaultJobStore;
  }

  return new PgJobStore(createPgPool(options));
}

function createPgPool(options: {
  databaseUrl?: string;
  searchPath?: string;
}): Pool {
  return new Pool({
    connectionString: resolveDatabaseUrl(options.databaseUrl),
    options:
      options.searchPath === undefined
        ? undefined
        : `-c search_path=${options.searchPath}`,
  });
}

function resolveDatabaseUrl(value?: string): string {
  if (value !== undefined && value.length > 0) {
    return value;
  }

  const environmentValue = process.env.DATABASE_URL;

  if (environmentValue === undefined || environmentValue.length === 0) {
    throw new Error("DATABASE_URL is required.");
  }

  return environmentValue;
}

function toJob(row: DbJobRow): Job {
  return {
    createdAt: row.created_at.toISOString(),
    failureStage: null,
    id: row.id,
    kind: row.kind,
    note: null,
    occurredAt: null,
    payload: row.payload,
    runAfter: row.run_after?.toISOString() ?? null,
    status: null,
  };
}

function toJobEvent(row: DbJobEventRow): JobEvent {
  return {
    failureStage: row.failure_stage,
    id: row.id,
    jobId: row.job_id,
    note: row.note,
    occurredAt: row.occurred_at.toISOString(),
    runtimeJobId: row.runtime_job_id,
    status: row.status as JobStatus,
  };
}

function toJobWithCurrentState(row: DbJobWithStateRow): Job {
  return {
    ...toJob(row),
    failureStage: row.current_failure_stage,
    note: row.current_note,
    occurredAt: row.current_occurred_at?.toISOString() ?? null,
    status: (row.current_status as JobStatus | null) ?? null,
  };
}

function withCurrentState(
  job: Job,
  row: {
    failureStage: string | null;
    note: string | null;
    occurredAt: string;
    status: JobStatus;
  },
): Job {
  return {
    ...job,
    failureStage: row.failureStage,
    note: row.note,
    occurredAt: row.occurredAt,
    status: row.status,
  };
}
