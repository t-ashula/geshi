import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";

import type { GeshiDatabase } from "../db/types.js";
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

type QueryExecutor = Kysely<GeshiDatabase>;

class PgJobStore implements JobStore {
  public constructor(private readonly db: Kysely<GeshiDatabase>) {}

  public async createJob(input: CreateJobInput): Promise<Job> {
    return this.db.transaction().execute(async (trx) => {
      const job = await this.insertJob(trx, input);
      const event = await this.insertJobEvent(trx, {
        failureStage: null,
        jobId: input.id,
        note: null,
        occurredAt: input.createdAt,
        runtimeJobId: null,
        status: "registered",
      });

      return withCurrentState(job, event);
    });
  }

  public async appendJobEvent(input: AppendJobEventInput): Promise<JobEvent> {
    return this.insertJobEvent(this.db, input);
  }

  public async getJob(jobId: string): Promise<Job | null> {
    const row = await this.selectJobsWithCurrentState()
      .where("jobs.id", "=", jobId)
      .executeTakeFirst();

    if (row === undefined) {
      return null;
    }

    return toJobWithCurrentState(row);
  }

  public async listJobs(): Promise<Job[]> {
    const result = await this.selectJobsWithCurrentState()
      .orderBy("jobs.created_at", "desc")
      .orderBy("jobs.id", "desc")
      .execute();

    return result.map((row) => toJobWithCurrentState(row));
  }

  private async insertJob(
    executor: QueryExecutor,
    input: CreateJobInput,
  ): Promise<Job> {
    const result = await executor
      .insertInto("jobs")
      .values({
        created_at: input.createdAt,
        id: input.id,
        kind: input.kind,
        payload: input.payload,
        run_after: input.runAfter,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toJob(result);
  }

  private async insertJobEvent(
    executor: QueryExecutor,
    input: AppendJobEventInput,
  ): Promise<JobEvent> {
    const result = await executor
      .insertInto("job_events")
      .values({
        failure_stage: input.failureStage,
        id: createUuidV7(),
        job_id: input.jobId,
        note: input.note,
        occurred_at: input.occurredAt,
        runtime_job_id: input.runtimeJobId,
        status: input.status,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toJobEvent(result);
  }

  private selectJobsWithCurrentState() {
    return this.db.selectFrom("jobs").select((eb) => [
      "jobs.id",
      "jobs.kind",
      "jobs.payload",
      "jobs.created_at",
      "jobs.run_after",
      eb
        .selectFrom("job_events")
        .select("job_events.status")
        .whereRef("job_events.job_id", "=", "jobs.id")
        .orderBy("job_events.occurred_at", "desc")
        .orderBy("job_events.id", "desc")
        .limit(1)
        .as("current_status"),
      eb
        .selectFrom("job_events")
        .select("job_events.failure_stage")
        .whereRef("job_events.job_id", "=", "jobs.id")
        .orderBy("job_events.occurred_at", "desc")
        .orderBy("job_events.id", "desc")
        .limit(1)
        .as("current_failure_stage"),
      eb
        .selectFrom("job_events")
        .select("job_events.occurred_at")
        .whereRef("job_events.job_id", "=", "jobs.id")
        .orderBy("job_events.occurred_at", "desc")
        .orderBy("job_events.id", "desc")
        .limit(1)
        .as("current_occurred_at"),
      eb
        .selectFrom("job_events")
        .select("job_events.note")
        .whereRef("job_events.job_id", "=", "jobs.id")
        .orderBy("job_events.occurred_at", "desc")
        .orderBy("job_events.id", "desc")
        .limit(1)
        .as("current_note"),
    ]);
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

    defaultJobStore = new PgJobStore(createPgDatabase({}));

    return defaultJobStore;
  }

  return new PgJobStore(createPgDatabase(options));
}

function createPgDatabase(options: {
  databaseUrl?: string;
  searchPath?: string;
}): Kysely<GeshiDatabase> {
  const pool = new Pool({
    connectionString: resolveDatabaseUrl(options.databaseUrl),
    options:
      options.searchPath === undefined
        ? undefined
        : `-c search_path=${options.searchPath}`,
  });

  return new Kysely<GeshiDatabase>({
    dialect: new PostgresDialect({
      pool,
    }),
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
