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
  Record<string, unknown> | string | undefined
>;

export type SourceTable = {
  created_at: TimestampColumn;
  id: string;
  kind: "feed" | "podcast" | "streaming";
  slug: string;
  url: string;
  url_hash: string;
};

export type UserTable = {
  created_at: TimestampColumn;
  id: string;
  slug: string;
};

export type SubscriptionTable = {
  collection_id: string | null;
  created_at: TimestampColumn;
  id: string;
  position: NumberColumn;
  source_id: string;
  user_id: string;
};

export type SubscriptionEventTable = {
  id: string;
  kind: "subscribed" | "unsubscribed";
  occurred_at: TimestampColumn;
  source_id: string;
  user_id: string;
};

export type CollectionTable = {
  created_at: TimestampColumn;
  id: string;
  parent_collection_id: string | null;
  position: NumberColumn;
  title: string;
  user_id: string;
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

export type PluginGlobalRuntimeStateTable = {
  created_at: TimestampColumn;
  id: string;
  plugin_slug: string;
};

export type PluginGlobalRuntimeStateSnapshotTable = {
  id: string;
  plugin_global_runtime_state_id: string;
  recorded_at: TimestampColumn;
  state: JsonColumn;
  version: number;
};

export type SourceDetectionTargetTable = {
  config: JsonColumn;
  created_at: TimestampColumn;
  enabled: GeneratedBooleanColumn;
  id: string;
  interval_minutes: NumberColumn;
  last_checked_at: NullableTimestampColumn;
  plugin_slug: string;
  source_kind: "feed" | "podcast" | "streaming";
  url: string;
  user_id: string;
};

export type SourceDetectionStateTable = {
  created_at: TimestampColumn;
  id: string;
  plugin_slug: string;
  source_detection_target_id: string;
  state: JsonColumn;
  updated_at: TimestampColumn;
};

export type DetectedSourceCandidateTable = {
  created_at: TimestampColumn;
  description: string | null;
  fingerprint: string;
  first_detected_at: TimestampColumn;
  id: string;
  last_detected_at: TimestampColumn;
  normalized_url: string;
  plugin_slug: string;
  resolved_source_id: string | null;
  source_detection_target_id: string;
  source_kind: "feed" | "podcast" | "streaming";
  source_slug: string;
  status: "detected" | "previewed" | "registered" | "dismissed" | "duplicate";
  title: string | null;
  user_id: string;
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
  metadata: JsonColumn;
  payload: JsonColumn;
  queue_job_id: string | null;
  retryable: GeneratedBooleanColumn;
  started_at: NullableTimestampColumn;
  status: "planned" | "queued" | "running" | "succeeded" | "failed";
};

export type TranscriptTable = {
  body: string | null;
  content_id: string;
  created_at: TimestampColumn;
  finished_at: NullableTimestampColumn;
  generation: number;
  id: string;
  kind: "transcript" | "ocr" | "extracted-text";
  source_asset_snapshot_id: string;
  started_at: NullableTimestampColumn;
  status: "queued" | "running" | "succeeded" | "failed";
};

export type DetailBodyTable = {
  body: string;
  content_id: string;
  created_at: TimestampColumn;
  format: "html" | "markdown" | "plain";
  id: string;
  source_asset_snapshot_id: string;
};

export type TranscriptChunkTable = {
  body: string | null;
  chunk_index: number;
  created_at: TimestampColumn;
  failure_message: string | null;
  finished_at: NullableTimestampColumn;
  id: string;
  source_end_ms: number;
  source_start_ms: number;
  started_at: NullableTimestampColumn;
  status: "queued" | "running" | "succeeded" | "failed" | "timed_out";
  storage_key: string | null;
  transcript_id: string;
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
  collections: CollectionTable;
  content_snapshots: ContentSnapshotTable;
  contents: ContentTable;
  detected_source_candidates: DetectedSourceCandidateTable;
  detail_bodies: DetailBodyTable;
  jobs: JobTable;
  plugin_global_runtime_states: PluginGlobalRuntimeStateTable;
  plugin_global_runtime_state_snapshots: PluginGlobalRuntimeStateSnapshotTable;
  source_detection_states: SourceDetectionStateTable;
  source_detection_targets: SourceDetectionTargetTable;
  source_snapshots: SourceSnapshotTable;
  sources: SourceTable;
  subscription_events: SubscriptionEventTable;
  subscriptions: SubscriptionTable;
  transcript_chunks: TranscriptChunkTable;
  transcripts: TranscriptTable;
  users: UserTable;
};
