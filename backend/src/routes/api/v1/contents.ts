import type { Hono } from "hono";

import { contentTypeToExtension } from "../../../lib/content-type-extension.js";
import type { AssetService } from "../../../service/asset-service.js";
import type { ContentService } from "../../../service/content-service.js";

type App = Hono;

export function registerContentRoutes(
  app: App,
  contentService: ContentService,
  assetService: AssetService,
): void {
  app.get("/api/v1/contents", async (context) => {
    const contents = await contentService.listContents();

    return context.json({
      data: contents,
    });
  });

  app.get("/api/v1/contents/:contentId", async (context) => {
    const content = await contentService.findContentDetail(
      context.req.param("contentId"),
    );

    if (content === null) {
      return context.json(
        {
          error: {
            code: "content_not_found",
            message: "Content was not found.",
          },
        },
        404,
      );
    }

    const assets = await assetService.listAssetsByContentId(content.id);

    return context.json({
      data: {
        ...content,
        assets: assets.map((asset) => ({
          byteSize: asset.byteSize,
          id: asset.id,
          kind: asset.kind,
          mimeType: asset.mimeType,
          primary: asset.primary,
          sourceUrl: asset.sourceUrl,
          url: buildAssetUrl(asset.id, asset.mimeType),
        })),
      },
    });
  });
}

function buildAssetUrl(
  assetId: string,
  mimeType: string | null,
): string | null {
  const extension = contentTypeToExtension(mimeType);

  if (extension === null) {
    return null;
  }

  return `/media/assets/${assetId}.${extension}`;
}
