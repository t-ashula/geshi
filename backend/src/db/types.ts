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
type NumberColumn = ColumnType<number, number | undefined, number>;
type JsonColumn = ColumnType<
  Record<string, unknown>,
  Record<string, unknown> | string | undefined,
  never
>;

export type SourceTable = {
  created_at: TimestampColumn;
  id: string;
  kind: "feed" | "podcast";
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
  periodical: GeneratedBooleanColumn;
  periodical_interval_minutes: NumberColumn;
  recorded_at: TimestampColumn;
  version: number;
};

export type CollectorPluginStateTable = {
  collector_setting_id: string;
  created_at: TimestampColumn;
  id: string;
  plugin_slug: string;
};

export type CollectorPluginStateSnapshotTable = {
  collector_plugin_state_id: string;
  id: string;
  recorded_at: TimestampColumn;
  state: JsonColumn;
  version: number;
};

export type AppSettingTable = {
  created_at: TimestampColumn;
  id: string;
  profile_slug: string;
};

export type AppSettingSnapshotTable = {
  app_setting_id: string;
  enabled: ColumnType<
    boolean | null,
    boolean | null | undefined,
    boolean | null
  >;
  id: string;
  interval_minutes: ColumnType<
    number | null,
    number | null | undefined,
    number | null
  >;
  recorded_at: TimestampColumn;
  version: number;
};

export type ContentTable = {
  collected_at: TimestampColumn;
  content_fingerprint: string;
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

export type AssetTable = {
  acquired_fingerprint: string | null;
  acquired_at: NullableTimestampColumn;
  content_id: string;
  created_at: TimestampColumn;
  id: string;
  is_primary: GeneratedBooleanColumn;
  kind: string;
  observed_fingerprint: string;
};

export type AssetSnapshotTable = {
  asset_id: string;
  byte_size: number | null;
  checksum: string | null;
  id: string;
  mime_type: string | null;
  recorded_at: TimestampColumn;
  source_url: string | null;
  storage_key: string | null;
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
  app_settings: AppSettingTable;
  app_setting_snapshots: AppSettingSnapshotTable;
  assets: AssetTable;
  asset_snapshots: AssetSnapshotTable;
  collector_plugin_states: CollectorPluginStateTable;
  collector_plugin_state_snapshots: CollectorPluginStateSnapshotTable;
  collector_setting_snapshots: CollectorSettingSnapshotTable;
  collector_settings: CollectorSettingTable;
  content_snapshots: ContentSnapshotTable;
  contents: ContentTable;
  jobs: JobTable;
  source_snapshots: SourceSnapshotTable;
  sources: SourceTable;
};
