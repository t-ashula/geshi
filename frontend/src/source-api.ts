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

export type DiscoverSourcesRequest = {
  url: string;
};

export type PreviewSourceRequest = {
  pluginSlug: string;
  url: string;
};

export type SourceCollectorPluginListItem = {
  description: string | null;
  displayName: string;
  message: string | null;
  pluginSlug: string;
  sourceKind: "feed" | "podcast" | "streaming";
  status: "available" | "unavailable";
};

export type SourceCollectorSettingFieldType = {
  type: string;
};

export type SourceCollectorSettingItem = {
  key: string;
  type: SourceCollectorSettingFieldType;
  value: boolean | null | number | string | Array<unknown> | object;
};

export type InspectSourceDraft = {
  description: string | null;
  sourceSlug: string;
  title: string | null;
  url: string;
};

export type SourceDiscoveryCandidate = {
  description: string | null;
  pluginSlug: string;
  previewAvailable: boolean;
  sourceKind: "feed" | "podcast" | "streaming";
  sourceSlug: string;
  title: string | null;
  url: string;
};

export type DiscoverSourcesResult = {
  candidates: SourceDiscoveryCandidate[];
};

export type SourcePreviewItem = {
  kind: string;
  publishedAt: string | null;
  summary: string | null;
  title: string | null;
};

export type PreviewSourceResult = {
  items: SourcePreviewItem[];
};

export type ApiError = {
  code: string;
  message: string;
};

export type SourceListItem = {
  collectionId: string | null;
  collectorSettingsVersion: number | null;
  contentCount: number;
  periodicCrawlEnabled: boolean;
  periodicCrawlIntervalMinutes: number;
  createdAt: string;
  description: string | null;
  id: string;
  kind: "feed" | "podcast" | "streaming";
  recordedAt: string | null;
  slug: string;
  subscriptionId: string;
  subscriptionPosition: number;
  title: string | null;
  url: string;
  urlHash: string;
  version: number | null;
};

export type SourceCollectionListItem = {
  createdAt: string;
  id: string;
  parentCollectionId: string | null;
  position: number;
  sourceCount: number;
  title: string;
};

export type PeriodicCrawlSettings = {
  enabled: boolean;
  intervalMinutes: number;
};

export type SourceDetectionTarget = {
  config: Record<string, unknown>;
  enabled: boolean;
  id: string;
  intervalMinutes: number;
  lastCheckedAt: string | null;
  pluginSlug: string;
  sourceKind: "feed" | "podcast" | "streaming";
  state?: Record<string, unknown>;
  url: string;
  userId: string;
};

export type CreateSourceDetectionTargetRequest = {
  config?: Record<string, unknown>;
  enabled?: boolean;
  intervalMinutes?: number;
  pluginSlug: string;
  sourceKind: "feed" | "podcast" | "streaming";
  url: string;
};

export type DetectedSourceCandidate = {
  description: string | null;
  firstDetectedAt: string;
  id: string;
  lastDetectedAt: string;
  normalizedUrl: string;
  pluginSlug: string;
  resolvedSourceId: string | null;
  sourceDetectionTargetId: string;
  sourceKind: "feed" | "podcast" | "streaming";
  sourceSlug: string;
  status: "detected" | "previewed" | "registered" | "dismissed" | "duplicate";
  title: string | null;
  userId: string;
};

export type SourceCollectorSettingsUpdate = PeriodicCrawlSettings & {
  baseVersion: number;
  items?: Array<{
    key: string;
    value: SourceCollectorSettingItem["value"];
  }>;
};

export type SourceCollectorSettingsDetail = {
  baseVersion: number;
  items: SourceCollectorSettingItem[];
  periodicCrawl: PeriodicCrawlSettings;
};

export type PluginGlobalSettingsUpdate = {
  baseVersion: number | null;
  items?: Array<{
    key: string;
    value: SourceCollectorSettingItem["value"];
  }>;
};

export type PluginGlobalSettingsDetail = {
  baseVersion: number | null;
  items: SourceCollectorSettingItem[];
  pluginSlug: string;
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

export type ContentListPage = {
  items: ContentListItem[];
  nextCursor: string | null;
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
  detailBody: {
    body: string;
    format: "html" | "markdown" | "plain";
  } | null;
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
  status: "planned" | "queued" | "running" | "succeeded" | "failed";
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

type ListSourceCollectionsResponse = {
  data: SourceCollectionListItem[];
};

type ListSourceCollectorPluginsResponse = {
  data: SourceCollectorPluginListItem[];
};

type ListContentsResponse = {
  data: ContentListItem[];
  page: {
    nextCursor: string | null;
  };
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

type SourceDetectionTargetsResponse = {
  data: SourceDetectionTarget[];
};

type SourceDetectionTargetResponse = {
  data: SourceDetectionTarget;
};

type DetectedSourceCandidatesResponse = {
  data: DetectedSourceCandidate[];
};

type InspectSourceResponse = {
  data: InspectSourceDraft;
};

type DiscoverSourcesResponse = {
  data: DiscoverSourcesResult;
};

type PreviewSourceResponse = {
  data: PreviewSourceResult;
};

type PeriodicCrawlSettingsResponse = {
  data: PeriodicCrawlSettings;
};

type SourceCollectorSettingsResponse = {
  data: SourceCollectorSettingsDetail;
};

type PluginGlobalSettingsResponse = {
  data: PluginGlobalSettingsDetail;
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

export async function listSourceCollections(): Promise<
  SourceCollectionListItem[]
> {
  const response = await fetch("/api/v1/collections");

  if (!response.ok) {
    throw new Error("Failed to load source collections.");
  }

  const payload = (await response.json()) as ListSourceCollectionsResponse;

  return payload.data;
}

export async function createSourceCollection(request: {
  parentCollectionId?: string | null;
  position: number;
  title: string;
}): Promise<SourceCollectionListItem> {
  const response = await fetch("/api/v1/collections", {
    body: JSON.stringify(request),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });
  const payload = (await response.json()) as
    { data: SourceCollectionListItem } | ErrorResponse;

  if (!response.ok && "error" in payload) {
    throw new Error(payload.error.message);
  }

  if ("data" in payload) {
    return payload.data;
  }

  throw new Error("Source collection creation failed.");
}

export async function assignSourceToCollection(
  sourceId: string,
  request: {
    collectionId?: string | null;
    position: number;
  },
): Promise<SourceListItem> {
  const response = await fetch(`/api/v1/sources/${sourceId}/collection`, {
    body: JSON.stringify(request),
    headers: {
      "content-type": "application/json",
    },
    method: "PATCH",
  });
  const payload = (await response.json()) as
    { data: SourceListItem } | ErrorResponse;

  if (!response.ok && "error" in payload) {
    throw new Error(payload.error.message);
  }

  if ("data" in payload) {
    return payload.data;
  }

  throw new Error("Source collection assignment failed.");
}

export async function unsubscribeSource(subscriptionId: string): Promise<void> {
  const response = await fetch(`/api/v1/subscriptions/${subscriptionId}`, {
    method: "DELETE",
  });

  if (response.status === 204) {
    return;
  }

  const payload = (await response.json()) as ErrorResponse;

  if ("error" in payload) {
    throw new Error(payload.error.message);
  }

  throw new Error("Source unsubscribe failed.");
}

export async function updateSourceCollection(
  collectionId: string,
  request: {
    parentCollectionId?: string | null;
    position: number;
    title: string;
  },
): Promise<SourceCollectionListItem> {
  const response = await fetch(`/api/v1/collections/${collectionId}`, {
    body: JSON.stringify(request),
    headers: {
      "content-type": "application/json",
    },
    method: "PATCH",
  });
  const payload = (await response.json()) as
    { data: SourceCollectionListItem } | ErrorResponse;

  if (!response.ok && "error" in payload) {
    throw new Error(payload.error.message);
  }

  if ("data" in payload) {
    return payload.data;
  }

  throw new Error("Source collection update failed.");
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
    CreateSourceResponse | ErrorResponse;

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
    InspectSourceResponse | ErrorResponse;

  if (!response.ok && "error" in payload) {
    throw new Error(payload.error.message);
  }

  if ("data" in payload) {
    return payload.data;
  }

  throw new Error("Source inspect failed.");
}

export async function discoverSources(
  request: DiscoverSourcesRequest,
): Promise<DiscoverSourcesResult> {
  const response = await fetch("/api/v1/sources/discover", {
    body: JSON.stringify(request),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });
  const payload = (await response.json()) as
    DiscoverSourcesResponse | ErrorResponse;

  if (!response.ok && "error" in payload) {
    throw new Error(payload.error.message);
  }

  if ("data" in payload) {
    return payload.data;
  }

  throw new Error("Source discovery failed.");
}

export async function previewSource(
  request: PreviewSourceRequest,
): Promise<PreviewSourceResult> {
  const response = await fetch("/api/v1/sources/preview", {
    body: JSON.stringify(request),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });
  const payload = (await response.json()) as
    PreviewSourceResponse | ErrorResponse;

  if (!response.ok && "error" in payload) {
    throw new Error(payload.error.message);
  }

  if ("data" in payload) {
    return payload.data;
  }

  throw new Error("Source preview failed.");
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

export async function listContents(request?: {
  cursor?: string;
  limit?: number;
  sourceSlug?: string;
}): Promise<ContentListPage> {
  const params = new URLSearchParams();

  if (request?.cursor !== undefined) {
    params.set("cursor", request.cursor);
  }

  if (request?.limit !== undefined) {
    params.set("limit", String(request.limit));
  }

  if (request?.sourceSlug !== undefined) {
    params.set("sourceSlug", request.sourceSlug);
  }

  const query = params.toString();
  const response = await fetch(
    query.length > 0 ? `/api/v1/contents?${query}` : "/api/v1/contents",
  );

  if (!response.ok) {
    throw new Error("Failed to load contents.");
  }

  const payload = (await response.json()) as ListContentsResponse;

  return {
    items: payload.data,
    nextCursor: payload.page.nextCursor,
  };
}

export async function getContentDetail(
  contentId: string,
): Promise<ContentDetailItem> {
  const response = await fetch(`/api/v1/contents/${contentId}`);
  const payload = (await response.json()) as
    ContentDetailResponse | ErrorResponse;

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
    TranscriptRequestResponse | ErrorResponse;

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
    { data: { jobId: string; transcriptId: string } } | ErrorResponse;

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
    PeriodicCrawlSettingsResponse | ErrorResponse;

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
    PeriodicCrawlSettingsResponse | ErrorResponse;

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
    CreateSourceResponse | ErrorResponse;

  if (!response.ok && "error" in payload) {
    throw new Error(payload.error.message);
  }

  if ("data" in payload) {
    return payload.data;
  }

  throw new Error("Failed to update source collector settings.");
}

export async function getSourceCollectorSettings(
  sourceId: string,
): Promise<SourceCollectorSettingsDetail> {
  const response = await fetch(
    `/api/v1/sources/${sourceId}/collector-settings`,
  );
  const payload = (await response.json()) as
    SourceCollectorSettingsResponse | ErrorResponse;

  if (!response.ok && "error" in payload) {
    throw new Error(payload.error.message);
  }

  if ("data" in payload) {
    return payload.data;
  }

  throw new Error("Failed to load source collector settings.");
}

export async function getPluginGlobalSettings(
  pluginSlug: string,
): Promise<PluginGlobalSettingsDetail> {
  const response = await fetch(`/api/v1/settings/plugins/${pluginSlug}`);
  const payload = (await response.json()) as
    PluginGlobalSettingsResponse | ErrorResponse;

  if (!response.ok && "error" in payload) {
    throw new Error(payload.error.message);
  }

  if ("data" in payload) {
    return payload.data;
  }

  throw new Error("Failed to load plugin global settings.");
}

export async function updatePluginGlobalSettings(
  pluginSlug: string,
  settings: PluginGlobalSettingsUpdate,
): Promise<PluginGlobalSettingsDetail> {
  const response = await fetch(`/api/v1/settings/plugins/${pluginSlug}`, {
    body: JSON.stringify(settings),
    headers: {
      "content-type": "application/json",
    },
    method: "PATCH",
  });
  const payload = (await response.json()) as
    PluginGlobalSettingsResponse | ErrorResponse;

  if (!response.ok && "error" in payload) {
    throw new Error(payload.error.message);
  }

  if ("data" in payload) {
    return payload.data;
  }

  throw new Error("Failed to update plugin global settings.");
}

export async function listSourceDetectionTargets(): Promise<
  SourceDetectionTarget[]
> {
  const response = await fetch("/api/v1/settings/source-detection/targets");
  const payload = (await response.json()) as
    SourceDetectionTargetsResponse | ErrorResponse;

  if (!response.ok && "error" in payload) {
    throw new Error(payload.error.message);
  }

  if ("data" in payload) {
    return payload.data;
  }

  throw new Error("Failed to load source detection targets.");
}

export async function createSourceDetectionTarget(
  request: CreateSourceDetectionTargetRequest,
): Promise<SourceDetectionTarget> {
  const response = await fetch("/api/v1/settings/source-detection/targets", {
    body: JSON.stringify(request),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });
  const payload = (await response.json()) as
    SourceDetectionTargetResponse | ErrorResponse;

  if (!response.ok && "error" in payload) {
    throw new Error(payload.error.message);
  }

  if ("data" in payload) {
    return payload.data;
  }

  throw new Error("Failed to create source detection target.");
}

export async function updateSourceDetectionTarget(
  targetId: string,
  request: CreateSourceDetectionTargetRequest,
): Promise<SourceDetectionTarget> {
  const response = await fetch(
    `/api/v1/settings/source-detection/targets/${targetId}`,
    {
      body: JSON.stringify(request),
      headers: {
        "content-type": "application/json",
      },
      method: "PATCH",
    },
  );
  const payload = (await response.json()) as
    SourceDetectionTargetResponse | ErrorResponse;

  if (!response.ok && "error" in payload) {
    throw new Error(payload.error.message);
  }

  if ("data" in payload) {
    return payload.data;
  }

  throw new Error("Failed to update source detection target.");
}

export async function listDetectedSourceCandidates(): Promise<
  DetectedSourceCandidate[]
> {
  const response = await fetch("/api/v1/settings/source-detection/candidates");
  const payload = (await response.json()) as
    DetectedSourceCandidatesResponse | ErrorResponse;

  if (!response.ok && "error" in payload) {
    throw new Error(payload.error.message);
  }

  if ("data" in payload) {
    return payload.data;
  }

  throw new Error("Failed to load detected source candidates.");
}

export async function dismissDetectedSourceCandidate(
  candidateId: string,
): Promise<DetectedSourceCandidate> {
  const response = await fetch(
    `/api/v1/settings/source-detection/candidates/${candidateId}/dismiss`,
    {
      method: "POST",
    },
  );
  const payload = (await response.json()) as
    { data: DetectedSourceCandidate } | ErrorResponse;

  if (!response.ok && "error" in payload) {
    throw new Error(payload.error.message);
  }

  if ("data" in payload) {
    return payload.data;
  }

  throw new Error("Failed to dismiss detected source candidate.");
}

export async function registerDetectedSourceCandidate(
  candidateId: string,
): Promise<DetectedSourceCandidate> {
  const response = await fetch(
    `/api/v1/settings/source-detection/candidates/${candidateId}/register`,
    {
      method: "POST",
    },
  );
  const payload = (await response.json()) as
    { data: DetectedSourceCandidate } | ErrorResponse;

  if (!response.ok && "error" in payload) {
    throw new Error(payload.error.message);
  }

  if ("data" in payload) {
    return payload.data;
  }

  throw new Error("Failed to register detected source candidate.");
}
