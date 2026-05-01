import { describe, expect, it, vi } from "vitest";

import { createGetMediaAssetEndpoint } from "../../src/endpoints/media/assets.js";
import { ok } from "../../src/lib/result.js";
import type { AssetService } from "../../src/service/asset-service.js";
import type { Storage } from "../../src/storage/types.js";
import { createTestAppDependencies } from "../support/app-dependencies.js";

describe("media asset endpoints", () => {
  it("returns stored media with content headers", async () => {
    const endpoint = createGetMediaAssetEndpoint(
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

    const result = await endpoint("asset-1.mp3");

    expect(result.status).toBe(200);
    if (result.body === null) {
      throw new Error("expected body");
    }
    expect(new Headers(result.headers).get("content-type")).toBe("audio/mpeg");
    expect(new Headers(result.headers).get("content-length")).toBe("3");
    expect(result.body).toEqual(new Uint8Array([1, 2, 3]));
  });
});
