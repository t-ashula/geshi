import { vi } from "vitest";

import type { AppDependencies } from "../../src/deps.js";
import { ok } from "../../src/lib/result.js";
import type { AppSettingService } from "../../src/service/app-setting-service.js";
import type { AssetService } from "../../src/service/asset-service.js";
import type { ContentService } from "../../src/service/content-service.js";
import type { JobService } from "../../src/service/job-service.js";
import type { SourceDetectionService } from "../../src/service/source-detection-service.js";
import type { SourceDiscoveryService } from "../../src/service/source-discovery-service.js";
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
            detailBody: null,
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
    detailBodyService: {
      findOrCreateDetailBodyByContentId: vi.fn(() => Promise.resolve(ok(null))),
    },
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
    pluginGlobalSettingsService: {
      getPluginGlobalSettings: vi.fn(() =>
        Promise.resolve(
          ok({
            baseVersion: null,
            items: [],
            pluginSlug: "podcast-rss",
          }),
        ),
      ),
      updatePluginGlobalSettings: vi.fn(() =>
        Promise.resolve(
          ok({
            baseVersion: 1,
            items: [],
            pluginSlug: "podcast-rss",
          }),
        ),
      ),
    },
    sourceDiscoveryService: {
      discoverSources: vi.fn(() =>
        Promise.resolve(
          ok({
            candidates: [
              {
                description: null,
                pluginSlug: "podcast-rss",
                previewAvailable: true,
                sourceKind: "podcast" as const,
                sourceSlug: "example-feed",
                title: "Example Feed",
                url: "https://example.com/feed.xml",
              },
            ],
          }),
        ),
      ),
      previewSource: vi.fn(() =>
        Promise.resolve(
          ok({
            items: [
              {
                kind: "episode",
                publishedAt: null,
                summary: null,
                title: "Episode 1",
              },
            ],
          }),
        ),
      ),
    } satisfies SourceDiscoveryService,
    sourceDetectionService: {
      createSourceDetectionTarget: vi.fn(() =>
        Promise.resolve(
          ok({
            config: {},
            enabled: true,
            id: "target-1",
            intervalMinutes: 60,
            lastCheckedAt: null,
            pluginSlug: "radio-onsen",
            sourceKind: "podcast" as const,
            state: undefined,
            url: "https://www.onsen.ag",
            userId: "user-1",
          }),
        ),
      ),
      detectSourceTarget: vi.fn(),
      dismissDetectedSourceCandidate: vi.fn(() =>
        Promise.resolve(
          ok({
            description: null,
            firstDetectedAt: new Date("2026-06-10T00:00:00.000Z"),
            id: "candidate-1",
            lastDetectedAt: new Date("2026-06-10T00:05:00.000Z"),
            normalizedUrl: "https://www.onsen.ag/program/example",
            pluginSlug: "radio-onsen",
            resolvedSourceId: null,
            sourceDetectionTargetId: "target-1",
            sourceKind: "podcast" as const,
            sourceSlug: "example",
            status: "dismissed" as const,
            title: "Example",
            userId: "user-1",
          }),
        ),
      ),
      listDetectedSourceCandidates: vi.fn(() =>
        Promise.resolve(
          ok([
            {
              description: null,
              firstDetectedAt: new Date("2026-06-10T00:00:00.000Z"),
              id: "candidate-1",
              lastDetectedAt: new Date("2026-06-10T00:00:00.000Z"),
              normalizedUrl: "https://www.onsen.ag/program/example",
              pluginSlug: "radio-onsen",
              resolvedSourceId: null,
              sourceDetectionTargetId: "target-1",
              sourceKind: "podcast" as const,
              sourceSlug: "example",
              status: "detected" as const,
              title: "Example",
              userId: "user-1",
            },
          ]),
        ),
      ),
      listTargets: vi.fn(() =>
        Promise.resolve(
          ok([
            {
              config: {},
              enabled: true,
              id: "target-1",
              intervalMinutes: 60,
              lastCheckedAt: null,
              pluginSlug: "radio-onsen",
              sourceKind: "podcast" as const,
              state: undefined,
              url: "https://www.onsen.ag",
              userId: "user-1",
            },
          ]),
        ),
      ),
      listEnabledTargets: vi.fn(() =>
        Promise.resolve(
          ok([
            {
              config: {},
              enabled: true,
              id: "target-1",
              intervalMinutes: 60,
              lastCheckedAt: null,
              pluginSlug: "radio-onsen",
              sourceKind: "podcast" as const,
              state: undefined,
              url: "https://www.onsen.ag",
              userId: "user-1",
            },
          ]),
        ),
      ),
      registerDetectedSourceCandidate: vi.fn(() =>
        Promise.resolve(
          ok({
            description: null,
            firstDetectedAt: new Date("2026-06-10T00:00:00.000Z"),
            id: "candidate-1",
            lastDetectedAt: new Date("2026-06-10T00:10:00.000Z"),
            normalizedUrl: "https://www.onsen.ag/program/example",
            pluginSlug: "radio-onsen",
            resolvedSourceId: "source-1",
            sourceDetectionTargetId: "target-1",
            sourceKind: "podcast" as const,
            sourceSlug: "example",
            status: "registered" as const,
            title: "Example",
            userId: "user-1",
          }),
        ),
      ),
      updateSourceDetectionTarget: vi.fn(() =>
        Promise.resolve(
          ok({
            config: {},
            enabled: false,
            id: "target-1",
            intervalMinutes: 120,
            lastCheckedAt: null,
            pluginSlug: "radio-onsen",
            sourceKind: "podcast" as const,
            state: undefined,
            url: "https://www.onsen.ag",
            userId: "user-1",
          }),
        ),
      ),
    } satisfies SourceDetectionService,
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
            collectionId: null,
            collectorSettingsVersion: 1,
            createdAt: new Date("2026-05-01T00:00:00.000Z"),
            description: null,
            id: "source-1",
            kind: "podcast",
            periodicCrawlEnabled: true,
            periodicCrawlIntervalMinutes: 60,
            recordedAt: null,
            slug: "example-feed",
            subscriptionId: "subscription-1",
            subscriptionPosition: 0,
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
      getSourceCollectorSettings: vi.fn(() =>
        Promise.resolve(
          ok({
            baseVersion: 1,
            items: [],
            periodicCrawl: {
              enabled: true,
              intervalMinutes: 60,
            },
          }),
        ),
      ),
      assignSourceToCollection: vi.fn(() =>
        Promise.resolve(
          ok({
            collectionId: null,
            collectorSettingsVersion: 1,
            createdAt: new Date("2026-05-01T00:00:00.000Z"),
            description: null,
            id: "source-1",
            kind: "podcast",
            periodicCrawlEnabled: true,
            periodicCrawlIntervalMinutes: 60,
            recordedAt: null,
            slug: "example-feed",
            subscriptionId: "subscription-1",
            subscriptionPosition: 0,
            title: "Example Feed",
            url: "https://example.com/feed.xml",
            urlHash: "hash-1",
            version: 1,
          }),
        ),
      ),
      createCollection: vi.fn(() =>
        Promise.resolve(
          ok({
            createdAt: new Date("2026-05-01T00:00:00.000Z"),
            id: "collection-1",
            parentCollectionId: null,
            position: 0,
            sourceCount: 0,
            title: "Default",
          }),
        ),
      ),
      listSources: vi.fn(() => Promise.resolve(ok([]))),
      listSourceCollections: vi.fn(() => Promise.resolve(ok([]))),
      unsubscribe: vi.fn(() => Promise.resolve(ok(undefined))),
      updateCollection: vi.fn(() =>
        Promise.resolve(
          ok({
            createdAt: new Date("2026-05-01T00:00:00.000Z"),
            id: "collection-1",
            parentCollectionId: null,
            position: 0,
            sourceCount: 0,
            title: "Default",
          }),
        ),
      ),
      updateSourceCollectorSettings: vi.fn(() =>
        Promise.resolve(
          ok({
            collectionId: null,
            collectorSettingsVersion: 1,
            createdAt: new Date("2026-05-01T00:00:00.000Z"),
            description: null,
            id: "source-1",
            kind: "podcast",
            periodicCrawlEnabled: true,
            periodicCrawlIntervalMinutes: 60,
            recordedAt: null,
            slug: "example-feed",
            subscriptionId: "subscription-1",
            subscriptionPosition: 0,
            title: "Example Feed",
            url: "https://example.com/feed.xml",
            urlHash: "hash-1",
            version: 1,
          }),
        ),
      ),
    } as unknown as SourceService,
    storage: {
      delete: vi.fn(() => Promise.resolve(ok(undefined))),
      get: vi.fn(() => Promise.resolve(ok(new Uint8Array([1, 2, 3])))),
      pathJoin: vi.fn((...parts: string[]) => parts.join("/")),
      put: vi.fn(),
    } satisfies Storage,
    transcriptService: {
      enqueueTranscriptsForContent: vi.fn(() =>
        Promise.resolve(
          ok({
            createdTranscriptCount: 0,
            skippedTranscriptCount: 0,
            transcripts: [],
          }),
        ),
      ),
      listTranscriptsByContentId: vi.fn(() => Promise.resolve(ok([]))),
      retryTranscript: vi.fn(() =>
        Promise.resolve(
          ok({
            jobId: "job-2",
            transcriptId: "transcript-1",
          }),
        ),
      ),
    },
    ...overrides,
  };
}
