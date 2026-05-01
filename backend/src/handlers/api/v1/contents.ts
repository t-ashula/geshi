import type { Context } from "hono";

import type { AppDependencies } from "../../../deps.js";
import { contentTypeToExtension } from "../../../lib/content-type-extension.js";

export function createListContentsHandler(dependencies: AppDependencies) {
  return async (context: Context) => {
    const contents = await dependencies.contentService.listContents();

    return context.json({
      data: contents,
    });
  };
}

export function createGetContentDetailHandler(dependencies: AppDependencies) {
  return async (context: Context) => {
    const result = await dependencies.contentService.findContentDetail(
      requireRouteParam(context, "contentId"),
    );

    if (!result.ok) {
      return context.json(
        {
          error: {
            code: result.error.code,
            message: result.error.message,
          },
        },
        404,
      );
    }

    const content = result.value;
    const assets = await dependencies.assetService.listAssetsByContentId(
      content.id,
    );

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
  };
}

function requireRouteParam(context: Context, name: string): string {
  const value = context.req.param(name);

  if (value === undefined) {
    throw new Error(`Missing route param: ${name}`);
  }

  return value;
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
