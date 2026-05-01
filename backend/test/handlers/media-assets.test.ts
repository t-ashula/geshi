import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import { createGetMediaAssetHandler } from "../../src/handlers/media/assets.js";
import { ok } from "../../src/lib/result.js";
import type { AssetService } from "../../src/service/asset-service.js";
import type { Storage } from "../../src/storage/types.js";
import { createTestAppDependencies } from "../support/app-dependencies.js";

describe("media asset handlers", () => {
  it("returns stored media with content headers", async () => {
    const handler = createGetMediaAssetHandler(
      createTestAppDependencies({
        assetService: {
          findStoredMediaById: vi.fn(() =>
            Promise.resolve(
              ok({
                byteSize: 3,
                id: "asset-1",
                mimeType: "audio/mpeg",
                storageKey: "stored/asset-1",
              }),
            ),
          ),
        } as unknown as AssetService,
        storage: {
          get: vi.fn(() => Promise.resolve(ok(new Uint8Array([1, 2, 3])))),
        } as unknown as Storage,
      }),
    );
    const app = new Hono();
    app.get("/:assetIdWithExtension", handler);

    const response = await app.request("/asset-1.mp3");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("audio/mpeg");
    expect(response.headers.get("content-length")).toBe("3");
    await expect(response.arrayBuffer()).resolves.toEqual(
      new Uint8Array([1, 2, 3]).buffer,
    );
  });
});
