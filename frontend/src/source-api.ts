export type CreateSourceRequest = {
  description: string;
  title: string;
  url: string;
};

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

type CreateSourceResponse = {
  data: SourceListItem;
};

type ErrorResponse = {
  error: {
    code: string;
    message: string;
  };
};

type ListSourcesResponse = {
  data: SourceListItem[];
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
