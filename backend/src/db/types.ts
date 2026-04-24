import type { ColumnType } from "kysely";

export interface GeshiDatabase {
  job_events: JobEventsTable;
  jobs: JobsTable;
}

interface JobEventsTable {
  failure_stage: string | null;
  id: string;
  job_id: string;
  note: string | null;
  occurred_at: TimestampColumn;
  runtime_job_id: string | null;
  status: string;
}

interface JobsTable {
  created_at: TimestampColumn;
  id: string;
  kind: string;
  payload: ColumnType<unknown, unknown, unknown>;
  run_after: NullableTimestampColumn;
}

type NullableTimestampColumn = ColumnType<
  Date | null,
  Date | string | null,
  Date | string | null
>;

type TimestampColumn = ColumnType<Date, Date | string, Date | string>;
