import type { ContentDetailAsset } from "../../../db/asset-repository.js";
import type {
  ContentDetailItem,
  ContentListItem,
} from "../../../db/content-repository.js";
import type { AppDependencies } from "../../../deps.js";
import { contentTypeToExtension } from "../../../lib/content-type-extension.js";
import type { Result } from "../../../lib/result.js";
import { ok } from "../../../lib/result.js";
import type { FindContentDetailError } from "../../../service/content-service.js";

export type ContentDetailEndpointValue = ContentDetailItem & {
  assets: Array<
    ContentDetailAsset & {
      url: string | null;
    }
  >;
};

export function createListContentsEndpoint(dependencies: AppDependencies) {
  return async (): Promise<ContentListItem[]> =>
    dependencies.contentService.listContents();
}

export function createGetContentDetailEndpoint(dependencies: AppDependencies) {
  return async (
    contentId: string,
  ): Promise<Result<ContentDetailEndpointValue, FindContentDetailError>> => {
    const result =
      await dependencies.contentService.findContentDetail(contentId);

    if (!result.ok) {
      return result;
    }

    const content = result.value;
    const assets = await dependencies.assetService.listAssetsByContentId(
      content.id,
    );

    return ok({
      ...content,
      assets: assets.map((asset) => ({
        ...asset,
        url: buildAssetUrl(asset.id, asset.mimeType),
      })),
    });
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
