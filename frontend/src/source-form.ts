import type { CreateSourceRequest } from "./source-api.js";

export function validateCreateSourceRequest(
  request: CreateSourceRequest,
): string | null {
  if ((request.pluginSlug ?? "").trim().length === 0) {
    return "Source collector plugin is required.";
  }

  const trimmedUrl = request.url.trim();

  if (trimmedUrl.length === 0) {
    return "Source URL is required.";
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(trimmedUrl);
  } catch {
    return "Source URL must be an absolute http or https URL.";
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return "Source URL must be an absolute http or https URL.";
  }

  return null;
}
