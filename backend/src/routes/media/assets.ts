import type { Hono } from "hono";

import { contentTypeToExtension } from "../../lib/content-type-extension.js";
import type { AssetService } from "../../service/asset-service.js";
import type { Storage } from "../../storage/types.js";

type App = Hono;

export function registerMediaAssetRoutes(
  app: App,
  assetService: AssetService,
  storage: Storage,
): void {
  app.get("/media/assets/:assetIdWithExtension", async (context) => {
    const parsed = parseAssetPath(context.req.param("assetIdWithExtension"));

    if (parsed === null) {
      return context.notFound();
    }

    const asset = await assetService.findStoredMediaById(parsed.assetId);

    if (asset === null) {
      return context.notFound();
    }

    const expectedExtension = contentTypeToExtension(asset.mimeType);

    if (expectedExtension === null || parsed.extension !== expectedExtension) {
      return context.notFound();
    }

    const body = await storage.get(asset.storageKey);
    const headers = new Headers({
      "Content-Type": asset.mimeType,
    });

    if (asset.byteSize !== null) {
      headers.set("Content-Length", String(asset.byteSize));
    }

    const responseBytes = new Uint8Array(body.byteLength);

    responseBytes.set(body);

    return new Response(responseBytes.buffer, {
      headers,
    });
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
