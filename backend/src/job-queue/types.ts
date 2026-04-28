export const OBSERVE_SOURCE_JOB_NAME = "observe-source";
export const ACQUIRE_CONTENT_JOB_NAME = "acquire-content";

export type ObserveSourceJobPayload = {
  collectorSettingId: string;
  collectorSettingSnapshotId: string;
  config: Record<string, unknown>;
  jobId: string;
  pluginSlug: string;
  slug: string;
  sourceId: string;
  sourceKind: "podcast";
  url: string;
};

export type AcquireContentJobPayload = {
  assetId: string;
  collectorSettingId: string;
  collectorSettingSnapshotId: string;
  config: Record<string, unknown>;
  contentId: string;
  jobId: string;
  pluginSlug: string;
  sourceId: string;
};

export type JobPayload = ObserveSourceJobPayload | AcquireContentJobPayload;

export interface JobQueue {
  enqueue(name: string, payload: JobPayload): Promise<string | null>;
}
