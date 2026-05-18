import { describe, expect, it, vi } from "vitest";

import { ok } from "../../src/lib/result.js";
import { createNoopLogger } from "../../src/logger/index.js";
import { createDetailBodyService } from "../../src/service/detail-body-service.js";

describe("detail body service", () => {
  it("extracts and stores a detail body from a stored html asset", async () => {
    const findLatestByPluginSlug = vi.fn(() =>
      Promise.resolve(
        ok({
          state: {
            sessionId: "shared-session",
          },
          version: 4,
        }),
      ),
    );
    const extract = vi.fn<
      (
        input: {
          asset: {
            body: Uint8Array;
            kind: string;
            mimeType: string | null;
            sourceUrl: string | null;
          };
        },
        context: {
          getHost(): {
            logger: unknown;
            pluginGlobalRuntimeState?: {
              load(): Promise<unknown>;
            };
          };
        },
      ) => Promise<{
        body: string;
        format: "plain";
      }>
    >(async (_input, context) => {
      const snapshot = await context.getHost().pluginGlobalRuntimeState?.load();

      expect(snapshot).toEqual({
        state: {
          sessionId: "shared-session",
        },
        version: 4,
      });

      return Promise.resolve({
        body: "Detailed body",
        format: "plain",
      });
    });
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
        extract,
      })),
      getSourceKind: vi.fn(),
      list: vi.fn(),
    };
    const service = createDetailBodyService(
      detailBodyRepository as never,
      storage,
      {
        logger: createNoopLogger(),
        pluginGlobalRuntimeStateRepository: {
          findLatestByPluginSlug,
          saveState: vi.fn(),
        } as never,
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
    expect(extract).toHaveBeenCalledTimes(1);
    const firstCall = extract.mock.calls[0][0];
    expect(firstCall.asset.sourceUrl).toBe("https://example.com/episodes/1");
    expect(extract.mock.calls[0][1]?.getHost().logger).toBeDefined();
    expect(findLatestByPluginSlug).toHaveBeenCalledWith("podcast-rss");
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
      {
        logger: createNoopLogger(),
      },
    );

    await expect(
      service.findOrCreateDetailBodyByContentId("content-1"),
    ).resolves.toEqual(ok(null));
  });

  it("returns null when plugin does not implement extract", async () => {
    const service = createDetailBodyService(
      {
        findDetailBodyByAssetSnapshotId: vi.fn(() => Promise.resolve(ok(null))),
        findDetailBodyByContentId: vi.fn(() => Promise.resolve(ok(null))),
        findHtmlDetailBodyTargetByContentId: vi.fn(() =>
          Promise.resolve(
            ok({
              assetId: "asset-1",
              assetKind: "html",
              contentId: "content-1",
              mimeType: "text/html",
              pluginSlug: "radio",
              sourceAssetSnapshotId: "asset-snapshot-1",
              sourceUrl: "https://example.com/programs/1",
              storageKey: "stored/asset-1.html",
            }),
          ),
        ),
      } as never,
      {
        get: vi.fn(() =>
          Promise.resolve(
            ok(new TextEncoder().encode("<html><body>Program</body></html>")),
          ),
        ),
      } as never,
      {
        logger: createNoopLogger(),
        sourceCollectorRegistry: {
          get: vi.fn(() => ({})),
          getSourceKind: vi.fn(),
          list: vi.fn(),
        } as never,
      },
    );

    await expect(
      service.findOrCreateDetailBodyByContentId("content-1"),
    ).resolves.toEqual(ok(null));
  });

  it("returns null when plugin loading fails", async () => {
    const service = createDetailBodyService(
      {
        findDetailBodyByAssetSnapshotId: vi.fn(() => Promise.resolve(ok(null))),
        findDetailBodyByContentId: vi.fn(() => Promise.resolve(ok(null))),
        findHtmlDetailBodyTargetByContentId: vi.fn(() =>
          Promise.resolve(
            ok({
              assetId: "asset-1",
              assetKind: "html",
              contentId: "content-1",
              mimeType: "text/html",
              pluginSlug: "radio",
              sourceAssetSnapshotId: "asset-snapshot-1",
              sourceUrl: "https://example.com/programs/1",
              storageKey: "stored/asset-1.html",
            }),
          ),
        ),
      } as never,
      {
        get: vi.fn(() =>
          Promise.resolve(
            ok(new TextEncoder().encode("<html><body>Program</body></html>")),
          ),
        ),
      } as never,
      {
        logger: createNoopLogger(),
        sourceCollectorRegistry: {
          get: vi.fn(() => {
            throw new Error("plugin unavailable");
          }),
          getSourceKind: vi.fn(),
          list: vi.fn(),
        },
      },
    );

    await expect(
      service.findOrCreateDetailBodyByContentId("content-1"),
    ).resolves.toEqual(ok(null));
  });

  it("returns null when extract throws", async () => {
    const extract = vi.fn(() => Promise.reject(new Error("extract failed")));
    const service = createDetailBodyService(
      {
        findDetailBodyByAssetSnapshotId: vi.fn(() => Promise.resolve(ok(null))),
        findDetailBodyByContentId: vi.fn(() => Promise.resolve(ok(null))),
        findHtmlDetailBodyTargetByContentId: vi.fn(() =>
          Promise.resolve(
            ok({
              assetId: "asset-1",
              assetKind: "html",
              contentId: "content-1",
              mimeType: "text/html",
              pluginSlug: "radio",
              sourceAssetSnapshotId: "asset-snapshot-1",
              sourceUrl: "https://example.com/programs/1",
              storageKey: "stored/asset-1.html",
            }),
          ),
        ),
      } as never,
      {
        get: vi.fn(() =>
          Promise.resolve(
            ok(new TextEncoder().encode("<html><body>Program</body></html>")),
          ),
        ),
      } as never,
      {
        logger: createNoopLogger(),
        sourceCollectorRegistry: {
          get: vi.fn(() => ({
            extract,
          })),
          getSourceKind: vi.fn(),
          list: vi.fn(),
        } as never,
      },
    );

    await expect(
      service.findOrCreateDetailBodyByContentId("content-1"),
    ).resolves.toEqual(ok(null));
  });
});
