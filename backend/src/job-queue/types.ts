export const OBSERVE_SOURCE_JOB_NAME = "observe-source";
export const ACQUIRE_CONTENT_JOB_NAME = "acquire-content";

export type ObserveSourceJobPayload = {
  jobId: string;
  collector: {
    config: Record<string, unknown>;
    pluginSlug: string;
    settingId: string;
    settingSnapshotId: string;
  };
  source: {
    id: string;
    kind: "podcast";
    slug: string;
    url: string;
  };
};

export type AcquireContentJobPayload = {
  jobId: string;
  collector: {
    config: Record<string, unknown>;
    pluginSlug: string;
    settingId: string;
    settingSnapshotId: string;
  };
  asset: {
    id: string;
    kind: string;
    observedFingerprint: string;
    primary: boolean;
    sourceUrl: string | null;
  };
  content: {
    externalId: string;
    id: string;
    kind: string;
    publishedAt: Date | null;
    status: "discovered" | "stored" | "failed";
    summary: string | null;
    title: string | null;
  };
  source: {
    id: string;
    slug: string;
  };
};

export type JobPayload = ObserveSourceJobPayload | AcquireContentJobPayload;

export interface JobQueue {
  enqueue(name: string, payload: JobPayload): Promise<string | null>;
}
