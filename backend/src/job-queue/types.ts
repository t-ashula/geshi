export const OBSERVE_SOURCE_JOB_NAME = "observe-source";

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

export type JobPayload = ObserveSourceJobPayload;

export interface JobQueue {
  enqueue(name: string, payload: JobPayload): Promise<string | null>;
}
