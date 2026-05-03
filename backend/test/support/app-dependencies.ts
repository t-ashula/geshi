import { vi } from "vitest";

import type { AppDependencies } from "../../src/deps.js";
import { ok } from "../../src/lib/result.js";
import type { AppSettingService } from "../../src/service/app-setting-service.js";
import type { AssetService } from "../../src/service/asset-service.js";
import type { ContentService } from "../../src/service/content-service.js";
import type { JobService } from "../../src/service/job-service.js";
import type { SourceInspectService } from "../../src/service/source-inspect-service.js";
import type { SourceService } from "../../src/service/source-service.js";
import type { Storage } from "../../src/storage/types.js";

export function createTestAppDependencies(
  overrides: Partial<AppDependencies> = {},
): AppDependencies {
  return {
    appSettingService: {
      getPeriodicCrawlSettings: vi.fn(() =>
        Promise.resolve(
          ok({
            enabled: true,
            intervalMinutes: 30,
          }),
        ),
      ),
      updatePeriodicCrawlSettings: vi.fn(() =>
        Promise.resolve(
          ok({
            enabled: true,
            intervalMinutes: 30,
          }),
        ),
      ),
    } as unknown as AppSettingService,
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
    contentService: {
      findContentDetail: vi.fn(() =>
        Promise.resolve(
          ok({
            collectedAt: new Date("2026-05-01T00:00:00.000Z"),
            id: "content-1",
            kind: "podcast-episode",
            publishedAt: null,
            source: {
              id: "source-1",
              slug: "example-feed",
              title: "Example Feed",
            },
            status: "stored",
            summary: null,
            title: "Episode 1",
          }),
        ),
      ),
      listContents: vi.fn(() => Promise.resolve([])),
    } as unknown as ContentService,
    jobService: {
      enqueueObserveSourceJob: vi.fn(() =>
        Promise.resolve(
          ok({
            attemptCount: 0,
            createdAt: new Date("2026-05-01T00:00:00.000Z"),
            failureMessage: null,
            finishedAt: null,
            id: "job-1",
            kind: "observe-source",
            queueJobId: "queue-1",
            retryable: true,
            sourceId: "source-1",
            startedAt: null,
            status: "queued",
          }),
        ),
      ),
      findJobById: vi.fn(() =>
        Promise.resolve(
          ok({
            attemptCount: 0,
            createdAt: new Date("2026-05-01T00:00:00.000Z"),
            failureMessage: null,
            finishedAt: null,
            id: "job-1",
            kind: "observe-source",
            queueJobId: "queue-1",
            retryable: true,
            sourceId: "source-1",
            startedAt: null,
            status: "queued",
          }),
        ),
      ),
    } as unknown as JobService,
    sourceInspectService: {
      inspectSource: vi.fn(() =>
        Promise.resolve(
          ok({
            description: null,
            sourceSlug: "example-feed",
            title: "Example Feed",
            url: "https://example.com/feed.xml",
          }),
        ),
      ),
    } satisfies SourceInspectService,
    sourceService: {
      createSource: vi.fn(() =>
        Promise.resolve(
          ok({
            collectorSettingsVersion: 1,
            createdAt: new Date("2026-05-01T00:00:00.000Z"),
            description: null,
            id: "source-1",
            kind: "podcast",
            periodicCrawlEnabled: true,
            periodicCrawlIntervalMinutes: 60,
            recordedAt: null,
            slug: "example-feed",
            title: "Example Feed",
            url: "https://example.com/feed.xml",
            urlHash: "hash-1",
            version: 1,
          }),
        ),
      ),
      listSourceCollectorPlugins: vi.fn(() =>
        ok([
          {
            description: "Podcast RSS and Atom feeds",
            displayName: "Podcast RSS",
            message: null,
            pluginSlug: "podcast-rss",
            sourceKind: "podcast" as const,
            status: "available" as const,
          },
        ]),
      ),
      listSources: vi.fn(() => Promise.resolve(ok([]))),
      updateSourceCollectorSettings: vi.fn(() =>
        Promise.resolve(
          ok({
            collectorSettingsVersion: 1,
            createdAt: new Date("2026-05-01T00:00:00.000Z"),
            description: null,
            id: "source-1",
            kind: "podcast",
            periodicCrawlEnabled: true,
            periodicCrawlIntervalMinutes: 60,
            recordedAt: null,
            slug: "example-feed",
            title: "Example Feed",
            url: "https://example.com/feed.xml",
            urlHash: "hash-1",
            version: 1,
          }),
        ),
      ),
    } as unknown as SourceService,
    storage: {
      get: vi.fn(() => Promise.resolve(ok(new Uint8Array([1, 2, 3])))),
      pathJoin: vi.fn((...parts: string[]) => parts.join("/")),
      put: vi.fn(),
    } satisfies Storage,
    ...overrides,
  };
}
