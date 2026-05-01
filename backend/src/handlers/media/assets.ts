import type { Context } from "hono";

import type { AppDependencies } from "../../deps.js";
import { contentTypeToExtension } from "../../lib/content-type-extension.js";

export function createGetMediaAssetHandler(dependencies: AppDependencies) {
  return async (context: Context) => {
    const parsed = parseAssetPath(
      requireRouteParam(context, "assetIdWithExtension"),
    );

    if (parsed === null) {
      return context.notFound();
    }

    const result = await dependencies.assetService.findStoredMediaById(
      parsed.assetId,
    );

    if (!result.ok) {
      return context.notFound();
    }

    const asset = result.value;
    const expectedExtension = contentTypeToExtension(asset.mimeType);

    if (expectedExtension === null || parsed.extension !== expectedExtension) {
      return context.notFound();
    }

    const body = await dependencies.storage.get(asset.storageKey);

    if (!body.ok) {
      return context.notFound();
    }
    const headers = new Headers({
      "Content-Type": asset.mimeType,
    });

    if (asset.byteSize !== null) {
      headers.set("Content-Length", String(asset.byteSize));
    }

    const responseBytes = new Uint8Array(body.value.byteLength);

    responseBytes.set(body.value);

    return new Response(responseBytes.buffer, {
      headers,
    });
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

function requireRouteParam(context: Context, name: string): string {
  const value = context.req.param(name);

  if (value === undefined) {
    throw new Error(`Missing route param: ${name}`);
  }

  return value;
}
