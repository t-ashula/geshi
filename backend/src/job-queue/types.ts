import type { SourceCollectorSourceKind } from "../plugins/types.js";

export const OBSERVE_SOURCE_JOB_NAME = "observe-source";
export const ACQUIRE_CONTENT_JOB_NAME = "acquire-content";
export const PERIODIC_CRAWL_JOB_NAME = "periodic-crawl";
export const TRANSCRIPT_SPLIT_JOB_NAME = "transcript-split";
export const TRANSCRIPT_CHUNK_JOB_NAME = "transcript-chunk";

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
    kind: SourceCollectorSourceKind;
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

export type PeriodicCrawlJobPayload = {
  jobId: string;
};

export type TranscriptSplitJobPayload = {
  jobId: string;
  mode: "initial" | "retry-failed";
  transcriptId: string;
};

export type TranscriptChunkJobPayload = {
  chunkIndex: number;
  jobId: string;
  storageKey: string;
  transcriptChunkId: string;
  transcriptId: string;
};

export type JobPayload =
  | ObserveSourceJobPayload
  | AcquireContentJobPayload
  | PeriodicCrawlJobPayload
  | TranscriptChunkJobPayload
  | TranscriptSplitJobPayload;

export interface JobQueue {
  enqueue(name: string, payload: JobPayload): Promise<string | null>;
  enqueueAfter(
    name: string,
    payload: JobPayload,
    startAfter: Date,
  ): Promise<string | null>;
}
