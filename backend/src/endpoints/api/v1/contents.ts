import type { AppDependencies } from "../../../deps.js";
import { contentTypeToExtension } from "../../../lib/content-type-extension.js";
import type { JsonEndpointResult } from "../../types.js";

export function createListContentsEndpoint(dependencies: AppDependencies) {
  return async (): Promise<JsonEndpointResult> => {
    const contents = await dependencies.contentService.listContents();

    return {
      body: {
        data: contents,
      },
      status: 200,
    };
  };
}

export function createGetContentDetailEndpoint(dependencies: AppDependencies) {
  return async (contentId: string): Promise<JsonEndpointResult> => {
    const result =
      await dependencies.contentService.findContentDetail(contentId);

    if (!result.ok) {
      return {
        body: {
          error: {
            code: result.error.code,
            message: result.error.message,
          },
        },
        status: 404,
      };
    }

    const content = result.value;
    const assets = await dependencies.assetService.listAssetsByContentId(
      content.id,
    );

    return {
      body: {
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
      },
      status: 200,
    };
  };
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
