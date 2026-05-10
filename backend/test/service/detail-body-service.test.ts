import { describe, expect, it, vi } from "vitest";

import { ok } from "../../src/lib/result.js";
import { createDetailBodyService } from "../../src/service/detail-body-service.js";

describe("detail body service", () => {
  it("extracts and stores a detail body from a stored html asset", async () => {
    const detailBodyRepository = {
      createDetailBody: vi.fn(() =>
        Promise.resolve(
          ok({
            body: "Detailed body",
            contentId: "content-1",
            createdAt: new Date("2026-05-01T00:00:00.000Z"),
            format: "plain",
            id: "detail-body-1",
            sourceAssetSnapshotId: "asset-snapshot-1",
          }),
        ),
      ),
      findDetailBodyByAssetSnapshotId: vi
        .fn()
        .mockResolvedValueOnce(ok(null))
        .mockResolvedValueOnce(ok(null)),
      findDetailBodyByContentId: vi.fn(() => Promise.resolve(ok(null))),
      findHtmlDetailBodyTargetByContentId: vi.fn(() =>
        Promise.resolve(
          ok({
            assetId: "asset-1",
            assetKind: "html",
            contentId: "content-1",
            mimeType: "text/html",
            pluginSlug: "podcast-rss",
            sourceAssetSnapshotId: "asset-snapshot-1",
            sourceUrl: "https://example.com/episodes/1",
            storageKey: "stored/asset-1.html",
          }),
        ),
      ),
    };
    const storage = {
      delete: vi.fn(),
      get: vi.fn(() =>
        Promise.resolve(
          ok(
            new TextEncoder().encode("<html><body>Detailed body</body></html>"),
          ),
        ),
      ),
      pathJoin: vi.fn(),
      put: vi.fn(),
    };
    const sourceCollectorRegistry = {
      get: vi.fn(() => ({
        extract: vi.fn(() =>
          Promise.resolve({
            body: "Detailed body",
            format: "plain",
          }),
        ),
      })),
      getSourceKind: vi.fn(),
      list: vi.fn(),
    };
    const service = createDetailBodyService(
      detailBodyRepository as never,
      storage,
      {
        sourceCollectorRegistry: sourceCollectorRegistry as never,
      },
    );

    await expect(
      service.findOrCreateDetailBodyByContentId("content-1"),
    ).resolves.toEqual(
      ok({
        body: "Detailed body",
        contentId: "content-1",
        createdAt: new Date("2026-05-01T00:00:00.000Z"),
        format: "plain",
        id: "detail-body-1",
        sourceAssetSnapshotId: "asset-snapshot-1",
      }),
    );
  });

  it("returns null when no stored html asset target exists", async () => {
    const service = createDetailBodyService(
      {
        findDetailBodyByContentId: vi.fn(() => Promise.resolve(ok(null))),
        findHtmlDetailBodyTargetByContentId: vi.fn(() =>
          Promise.resolve(ok(null)),
        ),
      } as never,
      {} as never,
    );

    await expect(
      service.findOrCreateDetailBodyByContentId("content-1"),
    ).resolves.toEqual(ok(null));
  });
});
