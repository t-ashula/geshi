import type { ContentDetailAsset } from "../../../db/asset-repository.js";
import type {
  ContentDetailItem,
  ContentListItem,
} from "../../../db/content-repository.js";
import type { TranscriptListItem } from "../../../db/transcript-repository.js";
import type { AppDependencies } from "../../../deps.js";
import { contentTypeToExtension } from "../../../lib/content-type-extension.js";
import type { Result } from "../../../lib/result.js";
import { ok } from "../../../lib/result.js";
import type { FindContentDetailError } from "../../../service/content-service.js";
import type {
  EnqueueTranscriptResult,
  RetryTranscriptResult,
  TranscriptServiceError,
} from "../../../service/transcript-service.js";

export type GetContentDetailEndpointError = FindContentDetailError;

export type ContentDetailEndpointValue = ContentDetailItem & {
  assets: Array<
    ContentDetailAsset & {
      url: string | null;
    }
  >;
  transcripts: TranscriptListItem[];
};

export function createListContentsEndpoint(dependencies: AppDependencies) {
  return async (): Promise<ContentListItem[]> =>
    dependencies.contentService.listContents();
}

export function createGetContentDetailEndpoint(dependencies: AppDependencies) {
  return async (
    contentId: string,
  ): Promise<
    Result<ContentDetailEndpointValue, GetContentDetailEndpointError>
  > => {
    const result =
      await dependencies.contentService.findContentDetail(contentId);

    if (!result.ok) {
      return result;
    }

    const content = result.value;
    const detailBody =
      await dependencies.detailBodyService.findOrCreateDetailBodyByContentId(
        content.id,
      );
    const assetsResult = await listDetailAssets(dependencies, content.id);
    const transcripts =
      await dependencies.transcriptService.listTranscriptsByContentId(
        content.id,
      );

    return ok({
      ...content,
      detailBody:
        !detailBody.ok || detailBody.value === null
          ? null
          : {
              body: detailBody.value.body,
              format: detailBody.value.format,
            },
      assets: assetsResult.map((asset) => ({
        ...asset,
        url: buildAssetUrl(asset.id, asset.mimeType),
      })),
      transcripts: transcripts.ok ? transcripts.value : [],
    });
  };
}

export function createRequestTranscriptsEndpoint(
  dependencies: AppDependencies,
) {
  return async (
    contentId: string,
  ): Promise<Result<EnqueueTranscriptResult, TranscriptServiceError>> =>
    dependencies.transcriptService.enqueueTranscriptsForContent(contentId);
}

export function createRetryTranscriptEndpoint(dependencies: AppDependencies) {
  return async (
    contentId: string,
    transcriptId: string,
  ): Promise<Result<RetryTranscriptResult, TranscriptServiceError>> =>
    dependencies.transcriptService.retryTranscript(contentId, transcriptId);
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

async function listDetailAssets(
  dependencies: AppDependencies,
  contentId: string,
): Promise<ContentDetailAsset[]> {
  try {
    return await dependencies.assetService.listAssetsByContentId(contentId);
  } catch {
    return [];
  }
}
