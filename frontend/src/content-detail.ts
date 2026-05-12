import type { ContentDetailItem } from "./source-api.js";

export type DetailDisplayContent =
  | {
      body: string;
      format: "html" | "markdown" | "plain";
      kind: "detail-body";
    }
  | {
      kind: "summary";
      summary: string;
    };

export function detailOriginalPageUrl(
  detail: ContentDetailItem,
): string | null {
  const primaryHtmlAsset =
    detail.assets.find(
      (asset) => asset.kind === "html" && asset.primary && asset.sourceUrl,
    ) ??
    detail.assets.find((asset) => asset.kind === "html" && asset.sourceUrl);

  return primaryHtmlAsset?.sourceUrl ?? null;
}

export function selectDetailDisplayContent(
  detail: ContentDetailItem,
): DetailDisplayContent | null {
  const detailBody = detail.detailBody;

  if (detailBody !== null && detailBody.body !== "") {
    return {
      body: detailBody.body,
      format: detailBody.format,
      kind: "detail-body",
    };
  }

  if (detail.summary !== null && detail.summary !== "") {
    return {
      kind: "summary",
      summary: detail.summary,
    };
  }

  return null;
}
