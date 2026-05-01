import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import {
  createGetContentDetailHandler,
  createListContentsHandler,
} from "../../src/handlers/api/v1/contents.js";
import { err, ok } from "../../src/lib/result.js";
import type { AssetService } from "../../src/service/asset-service.js";
import type { ContentService } from "../../src/service/content-service.js";
import { createTestAppDependencies } from "../support/app-dependencies.js";

describe("content handlers", () => {
  it("returns current content list shape", async () => {
    const app = new Hono();
    app.get(
      "/",
      createListContentsHandler(
        createTestAppDependencies({
          assetService: {} as unknown as AssetService,
          contentService: {
            listContents: vi.fn(() =>
              Promise.resolve([{ id: "content-1", title: "Episode 1" }]),
            ),
          } as unknown as ContentService,
        }),
      ),
    );

    const response = await app.request("/");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: [{ id: "content-1", title: "Episode 1" }],
    });
  });

  it("returns content detail with media asset urls", async () => {
    const handler = createGetContentDetailHandler(
      createTestAppDependencies({
        assetService: {
          listAssetsByContentId: vi.fn(() =>
            Promise.resolve([
              {
                byteSize: 128,
                id: "asset-1",
                kind: "audio",
                mimeType: "audio/mpeg",
                primary: true,
                sourceUrl: "https://cdn.example.com/audio.mp3",
                storageKey: "stored/asset-1",
              },
            ]),
          ),
        } as unknown as AssetService,
        contentService: {
          findContentDetail: vi.fn(() =>
            ok({
              collectedAt: new Date("2026-05-01T00:00:00.000Z"),
              id: "content-1",
              kind: "podcast-episode",
              publishedAt: new Date("2026-04-30T00:00:00.000Z"),
              source: {
                id: "source-1",
                slug: "example-feed",
                title: "Example Feed",
              },
              status: "stored",
              summary: "Episode summary",
              title: "Episode 1",
            }),
          ),
          listContents: vi.fn(),
        } as unknown as ContentService,
      }),
    );
    const app = new Hono();
    app.get("/:contentId", handler);

    const response = await app.request("/content-1");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        assets: [
          {
            id: "asset-1",
            url: "/media/assets/asset-1.mp3",
          },
        ],
        id: "content-1",
        title: "Episode 1",
      },
    });
  });

  it("preserves not-found responses", async () => {
    const handler = createGetContentDetailHandler(
      createTestAppDependencies({
        assetService: {
          listAssetsByContentId: vi.fn(),
        } as unknown as AssetService,
        contentService: {
          findContentDetail: vi.fn(() =>
            err({
              code: "content_not_found",
              message: "Content was not found.",
            }),
          ),
          listContents: vi.fn(),
        } as unknown as ContentService,
      }),
    );
    const app = new Hono();
    app.get("/:contentId", handler);

    const response = await app.request("/missing");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "content_not_found",
        message: "Content was not found.",
      },
    });
  });
});
