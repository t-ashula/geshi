import type {
  AcquiredAsset,
  SourceCollectorAcquireInput,
  SourceCollectorExecutionContext,
} from "@geshi/sdk";
import { describe, expect, it, vi } from "vitest";

import { ok } from "../../src/lib/result.js";
import { createNoopLogger } from "../../src/logger/index.js";
import { handleAcquireContentJob } from "../../src/workers/acquire-content/handle.js";

describe("acquire-content content status updates", () => {
  it("marks content stored when the stored asset is primary", async () => {
    const markContentStatus = vi.fn(() => Promise.resolve(ok(undefined)));

    const result = await handleAcquireContentJob(
      createAcquirePayload({ primary: true }),
      createDependencies({
        acquiredAssetPrimary: true,
        markContentStatus,
      }),
    );

    expect(result).toEqual(ok(undefined));
    expect(markContentStatus).toHaveBeenCalledWith("content-1", "stored");
  });

  it("does not mark content stored when the stored asset is not primary", async () => {
    const markContentStatus = vi.fn(() => Promise.resolve(ok(undefined)));

    const result = await handleAcquireContentJob(
      createAcquirePayload({ primary: false }),
      createDependencies({
        acquiredAssetPrimary: false,
        markContentStatus,
      }),
    );

    expect(result).toEqual(ok(undefined));
    expect(markContentStatus).not.toHaveBeenCalledWith("content-1", "stored");
  });
});

function createAcquirePayload(input: { primary: boolean }) {
  return {
    asset: {
      id: "asset-1",
      kind: "html",
      observedFingerprint: "asset-observed:1",
      primary: input.primary,
      sourceUrl: "https://example.com/contents/1",
    },
    collector: {
      config: {},
      pluginSlug: "feed-plugin-example",
      settingId: "collector-setting-1",
      settingSnapshotId: "collector-setting-snapshot-1",
    },
    content: {
      externalId: "content-1",
      id: "content-1",
      kind: "article",
      publishedAt: null,
      status: "discovered" as const,
      summary: "fixture summary",
      title: "Fixture Content",
    },
    jobId: "acquire-job-1",
    source: {
      id: "source-1",
      slug: "source-1",
    },
  };
}

function createDependencies(input: {
  acquiredAssetPrimary: boolean;
  markContentStatus: ReturnType<typeof vi.fn>;
}) {
  return {
    assetService: {
      upsertStoredAsset: vi.fn(() => Promise.resolve(ok(undefined))),
    } as never,
    contentService: {
      markContentStatus: input.markContentStatus,
    } as never,
    jobRepository: {
      markFailed: vi.fn(() => Promise.resolve(ok(undefined))),
      markRunning: vi.fn(() => Promise.resolve(ok(undefined))),
      markSucceeded: vi.fn(() => Promise.resolve(ok(undefined))),
    } as never,
    logger: createNoopLogger(),
    pluginGlobalRuntimeStateRepository: {
      findLatestByPluginSlug: vi.fn(() =>
        Promise.resolve(ok({ state: undefined, version: null })),
      ),
      saveState: vi.fn(() => Promise.resolve(ok(1))),
    } as never,
    sourceCollectorRegistry: {
      get: vi.fn(() => ({
        acquire: vi.fn(
          (
            input_: SourceCollectorAcquireInput,
            _context: SourceCollectorExecutionContext,
          ): Promise<AcquiredAsset> =>
            Promise.resolve({
              acquiredFingerprints: ["asset-acquired:1"],
              body: new Uint8Array([1, 2, 3]),
              contentType: "text/html",
              kind: input_.asset.kind,
              metadata: {},
              primary: input.acquiredAssetPrimary,
              sourceUrl: input_.asset.sourceUrl,
            }),
        ),
      })),
    } as never,
    storage: {
      pathJoin: (...parts: string[]) => parts.join("/"),
      put: vi.fn(() =>
        Promise.resolve(
          ok({
            byteSize: 3,
            key: "source-1/content-1/html/asset-1/title/acquired-1.html",
          }),
        ),
      ),
    } as never,
    workStorage: {
      delete: vi.fn(() => Promise.resolve(ok(undefined))),
      get: vi.fn(),
      pathJoin: (...parts: string[]) => parts.join("/"),
      put: vi.fn(),
    } as never,
  };
}
