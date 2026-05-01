import type { AppDependencies } from "../../deps.js";
import { contentTypeToExtension } from "../../lib/content-type-extension.js";
import type { BinaryEndpointResult } from "../types.js";

export function createGetMediaAssetEndpoint(dependencies: AppDependencies) {
  return async (
    assetIdWithExtension: string,
  ): Promise<BinaryEndpointResult> => {
    const parsed = parseAssetPath(assetIdWithExtension);

    if (parsed === null) {
      return { body: null, status: 404 };
    }

    const result = await dependencies.assetService.findStoredMediaById(
      parsed.assetId,
    );

    if (!result.ok) {
      return { body: null, status: 404 };
    }

    const asset = result.value;
    const expectedExtension = contentTypeToExtension(asset.mimeType);

    if (expectedExtension === null || parsed.extension !== expectedExtension) {
      return { body: null, status: 404 };
    }

    const body = await dependencies.storage.get(asset.storageKey);

    if (!body.ok) {
      return { body: null, status: 404 };
    }

    const headers = new Headers({
      "Content-Type": asset.mimeType,
    });

    if (asset.byteSize !== null) {
      headers.set("Content-Length", String(asset.byteSize));
    }

    const responseBytes = new Uint8Array(body.value.byteLength);

    responseBytes.set(body.value);

    return {
      body: responseBytes,
      headers,
      status: 200,
    };
  };
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
