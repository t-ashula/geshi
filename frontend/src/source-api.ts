export type CreateSourceRequest = {
  description: string;
  sourceSlug: string;
  title: string;
  url: string;
};

export type InspectSourceRequest = {
  url: string;
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

export type Result<T, E> = { ok: true; value: T } | { error: E; ok: false };

export type SourceListItem = {
  createdAt: string;
  description: string | null;
  id: string;
  kind: "podcast";
  recordedAt: string | null;
  slug: string;
  title: string | null;
  url: string;
  urlHash: string;
  version: number | null;
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

type ListContentsResponse = {
  data: ContentListItem[];
};

type ContentDetailResponse = {
  data: ContentDetailItem;
};

type JobResponse = {
  data: JobListItem;
};

type InspectSourceResponse = {
  data: InspectSourceDraft;
};

export async function listSources(): Promise<SourceListItem[]> {
  const response = await fetch("/api/v1/sources");

  if (!response.ok) {
    throw new Error("Failed to load sources.");
  }

  const payload = (await response.json()) as ListSourcesResponse;

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
): Promise<Result<InspectSourceDraft, ApiError>> {
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
    return {
      error: payload.error,
      ok: false,
    };
  }

  if ("data" in payload) {
    return {
      ok: true,
      value: payload.data,
    };
  }

  return {
    error: {
      code: "source_inspect_failed",
      message: "Source inspect failed.",
    },
    ok: false,
  };
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
