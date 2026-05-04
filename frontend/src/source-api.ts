export type CreateSourceRequest = {
  description: string;
  pluginSlug?: string;
  sourceSlug: string;
  title: string;
  url: string;
};

export type InspectSourceRequest = {
  pluginSlug?: string;
  url: string;
};

export type SourceCollectorPluginListItem = {
  description: string | null;
  displayName: string;
  message: string | null;
  pluginSlug: string;
  sourceKind: "feed" | "podcast";
  status: "available" | "unavailable";
};

export type InspectSourceDraft = {
  description: string | null;
  sourceSlug: string;
  title: string | null;
  url: string;
};

export type ApiError = {
  code: string;
  message: string;
};

export type SourceListItem = {
  collectorSettingsVersion: number | null;
  periodicCrawlEnabled: boolean;
  periodicCrawlIntervalMinutes: number;
  createdAt: string;
  description: string | null;
  id: string;
  kind: "feed" | "podcast";
  recordedAt: string | null;
  slug: string;
  title: string | null;
  url: string;
  urlHash: string;
  version: number | null;
};

export type PeriodicCrawlSettings = {
  enabled: boolean;
  intervalMinutes: number;
};

export type SourceCollectorSettingsUpdate = PeriodicCrawlSettings & {
  baseVersion: number;
};

export type ContentListItem = {
  collectedAt: string;
  id: string;
  kind: string;
  publishedAt: string | null;
  sourceId: string;
  sourceSlug: string;
  status: "discovered" | "stored" | "failed";
  summary: string | null;
  title: string | null;
};

export type ContentDetailAsset = {
  byteSize: number | null;
  id: string;
  kind: string;
  mimeType: string | null;
  primary: boolean;
  sourceUrl: string | null;
  url: string | null;
};

export type ContentTranscriptItem = {
  body: string | null;
  createdAt: string;
  failedChunkCount: number;
  finishedAt: string | null;
  generation: number;
  id: string;
  kind: "transcript" | "ocr" | "extracted-text";
  retryAvailable: boolean;
  sourceAsset: {
    assetId: string;
    assetSnapshotId: string;
    byteSize: number | null;
    kind: string;
    mimeType: string | null;
    primary: boolean;
    sourceUrl: string | null;
  };
  startedAt: string | null;
  status: "queued" | "running" | "succeeded" | "failed";
  totalChunkCount: number;
};

export type ContentDetailItem = {
  assets: ContentDetailAsset[];
  collectedAt: string;
  id: string;
  kind: string;
  publishedAt: string | null;
  source: {
    id: string;
    slug: string;
    title: string | null;
  };
  status: "discovered" | "stored" | "failed";
  summary: string | null;
  title: string | null;
  transcripts: ContentTranscriptItem[];
};

export type JobListItem = {
  attemptCount: number;
  createdAt: string;
  failureMessage: string | null;
  finishedAt: string | null;
  id: string;
  kind: string;
  queueJobId: string | null;
  retryable: boolean;
  sourceId: string | null;
  startedAt: string | null;
  status: "queued" | "running" | "succeeded" | "failed";
};

type CreateSourceResponse = {
  data: SourceListItem;
};

type ErrorResponse = {
  error: ApiError;
};

type ListSourcesResponse = {
  data: SourceListItem[];
};

type ListSourceCollectorPluginsResponse = {
  data: SourceCollectorPluginListItem[];
};

type ListContentsResponse = {
  data: ContentListItem[];
};

type ContentDetailResponse = {
  data: ContentDetailItem;
};

type TranscriptRequestResponse = {
  data: {
    createdTranscriptCount: number;
    skippedTranscriptCount: number;
    transcripts: Array<{
      id: string;
    }>;
  };
};

type JobResponse = {
  data: JobListItem;
};

type InspectSourceResponse = {
  data: InspectSourceDraft;
};

type PeriodicCrawlSettingsResponse = {
  data: PeriodicCrawlSettings;
};

export async function listSources(): Promise<SourceListItem[]> {
  const response = await fetch("/api/v1/sources");

  if (!response.ok) {
    throw new Error("Failed to load sources.");
  }

  const payload = (await response.json()) as ListSourcesResponse;

  return payload.data;
}

export async function listSourceCollectorPlugins(): Promise<
  SourceCollectorPluginListItem[]
> {
  const response = await fetch("/api/v1/sources/collector-plugins");

  if (!response.ok) {
    throw new Error("Failed to load source collector plugins.");
  }

  const payload = (await response.json()) as ListSourceCollectorPluginsResponse;

  return payload.data;
}

export async function createSource(
  request: CreateSourceRequest,
): Promise<SourceListItem> {
  const response = await fetch("/api/v1/sources", {
    body: JSON.stringify(request),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });
  const payload = (await response.json()) as
    | CreateSourceResponse
    | ErrorResponse;

  if (!response.ok && "error" in payload) {
    throw new Error(payload.error.message);
  }

  if ("data" in payload) {
    return payload.data;
  }

  throw new Error("Source registration failed.");
}

export async function inspectSource(
  request: InspectSourceRequest,
): Promise<InspectSourceDraft> {
  const response = await fetch("/api/v1/sources/inspect", {
    body: JSON.stringify(request),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });
  const payload = (await response.json()) as
    | InspectSourceResponse
    | ErrorResponse;

  if (!response.ok && "error" in payload) {
    throw new Error(payload.error.message);
  }

  if ("data" in payload) {
    return payload.data;
  }

  throw new Error("Source inspect failed.");
}

export async function observeSource(sourceId: string): Promise<JobListItem> {
  const response = await fetch(`/api/v1/sources/${sourceId}/observe`, {
    method: "POST",
  });
  const payload = (await response.json()) as JobResponse | ErrorResponse;

  if (!response.ok && "error" in payload) {
    throw new Error(payload.error.message);
  }

  if ("data" in payload) {
    return payload.data;
  }

  throw new Error("Observe job enqueue failed.");
}

export async function getJob(jobId: string): Promise<JobListItem> {
  const response = await fetch(`/api/v1/jobs/${jobId}`);
  const payload = (await response.json()) as JobResponse | ErrorResponse;

  if (!response.ok && "error" in payload) {
    throw new Error(payload.error.message);
  }

  if ("data" in payload) {
    return payload.data;
  }

  throw new Error("Failed to load job.");
}

export async function listContents(): Promise<ContentListItem[]> {
  const response = await fetch("/api/v1/contents");

  if (!response.ok) {
    throw new Error("Failed to load contents.");
  }

  const payload = (await response.json()) as ListContentsResponse;

  return payload.data;
}

export async function getContentDetail(
  contentId: string,
): Promise<ContentDetailItem> {
  const response = await fetch(`/api/v1/contents/${contentId}`);
  const payload = (await response.json()) as
    | ContentDetailResponse
    | ErrorResponse;

  if (!response.ok && "error" in payload) {
    throw new Error(payload.error.message);
  }

  if ("data" in payload) {
    return payload.data;
  }

  throw new Error("Failed to load content detail.");
}

export async function requestTranscripts(
  contentId: string,
): Promise<TranscriptRequestResponse["data"]> {
  const response = await fetch(`/api/v1/contents/${contentId}/transcripts`, {
    method: "POST",
  });
  const payload = (await response.json()) as
    | TranscriptRequestResponse
    | ErrorResponse;

  if (!response.ok && "error" in payload) {
    throw new Error(payload.error.message);
  }

  if ("data" in payload) {
    return payload.data;
  }

  throw new Error("Failed to request transcripts.");
}

export async function retryTranscript(
  contentId: string,
  transcriptId: string,
): Promise<{ jobId: string; transcriptId: string }> {
  const response = await fetch(
    `/api/v1/contents/${contentId}/transcripts/${transcriptId}/retry`,
    {
      method: "POST",
    },
  );
  const payload = (await response.json()) as
    | { data: { jobId: string; transcriptId: string } }
    | ErrorResponse;

  if (!response.ok && "error" in payload) {
    throw new Error(payload.error.message);
  }

  if ("data" in payload) {
    return payload.data;
  }

  throw new Error("Failed to retry transcript.");
}

export async function getPeriodicCrawlSettings(): Promise<PeriodicCrawlSettings> {
  const response = await fetch("/api/v1/settings/periodic-crawl");
  const payload = (await response.json()) as
    | PeriodicCrawlSettingsResponse
    | ErrorResponse;

  if (!response.ok && "error" in payload) {
    throw new Error(payload.error.message);
  }

  if ("data" in payload) {
    return payload.data;
  }

  throw new Error("Failed to load autonomous crawl settings.");
}

export async function updatePeriodicCrawlSettings(
  settings: PeriodicCrawlSettings,
): Promise<PeriodicCrawlSettings> {
  const response = await fetch("/api/v1/settings/periodic-crawl", {
    body: JSON.stringify(settings),
    headers: {
      "content-type": "application/json",
    },
    method: "PATCH",
  });
  const payload = (await response.json()) as
    | PeriodicCrawlSettingsResponse
    | ErrorResponse;

  if (!response.ok && "error" in payload) {
    throw new Error(payload.error.message);
  }

  if ("data" in payload) {
    return payload.data;
  }

  throw new Error("Failed to update autonomous crawl settings.");
}

export async function updateSourceCollectorSettings(
  sourceId: string,
  settings: SourceCollectorSettingsUpdate,
): Promise<SourceListItem> {
  const response = await fetch(
    `/api/v1/sources/${sourceId}/collector-settings`,
    {
      body: JSON.stringify(settings),
      headers: {
        "content-type": "application/json",
      },
      method: "PATCH",
    },
  );
  const payload = (await response.json()) as
    | CreateSourceResponse
    | ErrorResponse;

  if (!response.ok && "error" in payload) {
    throw new Error(payload.error.message);
  }

  if ("data" in payload) {
    return payload.data;
  }

  throw new Error("Failed to update source collector settings.");
}
