import type { AppDependencies } from "../../deps.js";
import { contentTypeToExtension } from "../../lib/content-type-extension.js";
import type { Result } from "../../lib/result.js";
import { err, ok } from "../../lib/result.js";

export type MediaAssetEndpointValue = {
  byteSize: number | null;
  bytes: Uint8Array;
  mimeType: string;
};

export type MediaAssetEndpointError = {
  code: "asset_media_not_found";
  message: string;
};

export function createGetMediaAssetEndpoint(dependencies: AppDependencies) {
  return async (
    assetIdWithExtension: string,
  ): Promise<Result<MediaAssetEndpointValue, MediaAssetEndpointError>> => {
    const parsed = parseAssetPath(assetIdWithExtension);

    if (parsed === null) {
      return errNotFound();
    }

    const result = await dependencies.assetService.findStoredMediaById(
      parsed.assetId,
    );

    if (!result.ok) {
      return errNotFound();
    }

    const asset = result.value;
    const expectedExtension = contentTypeToExtension(asset.mimeType);

    if (expectedExtension === null || parsed.extension !== expectedExtension) {
      return errNotFound();
    }

    const body = await dependencies.storage.get(asset.storageKey);

    if (!body.ok) {
      return errNotFound();
    }

    const responseBytes = new Uint8Array(body.value.byteLength);

    responseBytes.set(body.value);

    return ok({
      byteSize: asset.byteSize,
      bytes: responseBytes,
      mimeType: asset.mimeType,
    });
  };
}

function errNotFound(): Result<never, MediaAssetEndpointError> {
  return err({
    code: "asset_media_not_found",
    message: "Stored media asset was not found.",
  });
}

function parseAssetPath(
  assetIdWithExtension: string,
): { assetId: string; extension: string } | null {
  const dotIndex = assetIdWithExtension.lastIndexOf(".");

  if (dotIndex <= 0 || dotIndex === assetIdWithExtension.length - 1) {
    return null;
  }

  return {
    assetId: assetIdWithExtension.slice(0, dotIndex),
    extension: assetIdWithExtension.slice(dotIndex + 1),
  };
}
