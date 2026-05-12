import { describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app.js";
import { ok } from "../src/lib/result.js";
import type { AssetService } from "../src/service/asset-service.js";
import { createTestAppDependencies } from "./support/app-dependencies.js";

describe("createApp", () => {
  it("mounts the expected backend endpoints", async () => {
    const dependencies = createTestAppDependencies({
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
        listAssetsByContentId: vi.fn(() => Promise.resolve([])),
      } as unknown as AssetService,
    });
    const app = createApp(dependencies);

    expect((await app.request("/api/v1/sources")).status).toBe(200);
    expect(
      (
        await app.request("/api/v1/sources/inspect", {
          body: JSON.stringify({
            url: "https://example.com/feed.xml",
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        })
      ).status,
    ).toBe(200);
    expect((await app.request("/api/v1/contents")).status).toBe(200);
    expect((await app.request("/api/v1/jobs/job-1")).status).toBe(200);
    expect((await app.request("/api/v1/settings/periodic-crawl")).status).toBe(
      200,
    );
    expect((await app.request("/media/assets/asset-1.mp3")).status).toBe(200);
  });
});
