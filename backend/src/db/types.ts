import type { ColumnType } from "kysely";

type TimestampColumn = ColumnType<
  Date,
  Date | string | undefined,
  Date | string | undefined
>;
type NullableTimestampColumn = ColumnType<
  Date | null,
  Date | string | null | undefined,
  Date | string | null | undefined
>;
type GeneratedNumberColumn = ColumnType<number, number | undefined, number>;
type GeneratedBooleanColumn = ColumnType<boolean, boolean | undefined, boolean>;
type JsonColumn = ColumnType<
  Record<string, unknown>,
  Record<string, unknown> | string | undefined,
  never
>;

export type SourceTable = {
  created_at: TimestampColumn;
  id: string;
  kind: "podcast";
  slug: string;
  url: string;
  url_hash: string;
};

export type SourceSnapshotTable = {
  description: string | null;
  id: string;
  recorded_at: TimestampColumn;
  source_id: string;
  title: string | null;
  version: number;
};

export type CollectorSettingTable = {
  created_at: TimestampColumn;
  id: string;
  plugin_slug: string;
  source_id: string;
};

export type CollectorSettingSnapshotTable = {
  collector_setting_id: string;
  config: JsonColumn;
  enabled: GeneratedBooleanColumn;
  id: string;
  recorded_at: TimestampColumn;
  version: number;
};

export type ContentTable = {
  collected_at: TimestampColumn;
  created_at: TimestampColumn;
  external_id: string;
  id: string;
  kind: string;
  published_at: NullableTimestampColumn;
  source_id: string;
  status: "discovered" | "stored" | "failed";
};

export type ContentSnapshotTable = {
  content_id: string;
  id: string;
  recorded_at: TimestampColumn;
  summary: string | null;
  title: string | null;
  version: number;
};

export type JobTable = {
  attempt_count: GeneratedNumberColumn;
  created_at: TimestampColumn;
  failure_message: string | null;
  finished_at: NullableTimestampColumn;
  id: string;
  kind: string;
  queue_job_id: string | null;
  retryable: GeneratedBooleanColumn;
  source_id: string | null;
  started_at: NullableTimestampColumn;
  status: "queued" | "running" | "succeeded" | "failed";
};

export type GeshiDatabase = {
  collector_setting_snapshots: CollectorSettingSnapshotTable;
  collector_settings: CollectorSettingTable;
  content_snapshots: ContentSnapshotTable;
  contents: ContentTable;
  jobs: JobTable;
  source_snapshots: SourceSnapshotTable;
  sources: SourceTable;
};
