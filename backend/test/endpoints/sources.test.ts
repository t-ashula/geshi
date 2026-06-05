import { describe, expect, it, vi } from "vitest";

import type { SourceListItem } from "../../src/db/source-repository.js";
import {
  CollectorSettingsVersionConflictError,
  DuplicateSourceUrlHashError,
} from "../../src/db/source-repository.js";
import {
  createAssignSourceToCollectionEndpoint,
  createCreateSourceCollectionEndpoint,
  createCreateSourceEndpoint,
  createDiscoverSourcesEndpoint,
  createEnqueueObserveSourceEndpoint,
  createGetSourceCollectorSettingsEndpoint,
  createInspectSourceEndpoint,
  createListSourceCollectionsEndpoint,
  createListSourceCollectorPluginsEndpoint,
  createListSourcesEndpoint,
  createPatchSourceCollectorSettingsEndpoint,
  createPreviewSourceEndpoint,
  createUnsubscribeEndpoint,
  createUpdateSourceCollectionEndpoint,
} from "../../src/endpoints/api/v1/sources.js";
import { err, ok } from "../../src/lib/result.js";
import type { JobService } from "../../src/service/job-service.js";
import type { SourceDiscoveryService } from "../../src/service/source-discovery-service.js";
import type { SourceInspectService } from "../../src/service/source-inspect-service.js";
import type { SourceService } from "../../src/service/source-service.js";
import { createTestAppDependencies } from "../support/app-dependencies.js";
import { assertErr, assertOk } from "../support/result.js";

describe("source endpoints", () => {
  it("returns source lists", async () => {
    const endpoint = createListSourcesEndpoint(
      createTestAppDependencies({
        sourceService: {
          createSource: vi.fn(),
          listSources: vi.fn(() =>
            Promise.resolve(
              ok([
                {
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
                },
              ]),
            ),
          ),
          updateSourceCollectorSettings: vi.fn(),
        } as unknown as SourceService,
      }),
    );

    const result = await endpoint();

    assertOk(result);
    expect(result.value).toHaveLength(1);
    expect(result.value[0]?.id).toBe("source-1");
  });

  it("maps source list failures", async () => {
    const endpoint = createListSourcesEndpoint(
      createTestAppDependencies({
        sourceService: {
          createSource: vi.fn(),
          listSources: vi.fn(() =>
            Promise.resolve(err(new Error("list failed"))),
          ),
          updateSourceCollectorSettings: vi.fn(),
        } as unknown as SourceService,
      }),
    );

    const result = await endpoint();

    assertErr(result);
    expect(result.error).toEqual({
      code: "source_list_failed",
      message: "list failed",
    });
  });

  it("returns source collector plugins", () => {
    const endpoint = createListSourceCollectorPluginsEndpoint(
      createTestAppDependencies({
        sourceService: {
          createSource: vi.fn(),
          listSourceCollectorPlugins: () =>
            ok([
              {
                description: "Collect podcast RSS and Atom feeds.",
                displayName: "Podcast RSS",
                message: null,
                pluginSlug: "podcast-rss",
                sourceKind: "podcast" as const,
                status: "available" as const,
              },
              {
                description: "Collect gov-online updates.",
                displayName: "Go JP RSS",
                message: null,
                pluginSlug: "go-jp-rss",
                sourceKind: "feed" as const,
                status: "available" as const,
              },
            ]),
          listSources: vi.fn(),
          updateSourceCollectorSettings: vi.fn(),
        } as unknown as SourceService,
      }),
    );

    const result = endpoint();

    assertOk(result);
    expect(result.value).toEqual([
      {
        description: "Collect podcast RSS and Atom feeds.",
        displayName: "Podcast RSS",
        message: null,
        pluginSlug: "podcast-rss",
        sourceKind: "podcast",
        status: "available",
      },
      {
        description: "Collect gov-online updates.",
        displayName: "Go JP RSS",
        message: null,
        pluginSlug: "go-jp-rss",
        sourceKind: "feed",
        status: "available",
      },
    ]);
  });

  it("returns the current create-source response on success", async () => {
    const endpoint = createCreateSourceEndpoint(
      createTestAppDependencies({
        jobService: {
          enqueueObserveSourceJob: vi.fn(),
        } as unknown as JobService,
        sourceInspectService: {
          inspectSource: vi.fn(),
        },
        sourceService: {
          assignSourceToCollection: vi.fn(),
          createCollection: vi.fn(),
          createSource: vi.fn(() =>
            Promise.resolve(
              ok({
                collectionId: null,
                collectorSettingsVersion: 1,
                createdAt: new Date("2026-05-01T00:00:00.000Z"),
                description: "Weekly notes",
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
              } satisfies SourceListItem),
            ),
          ),
          findObserveSourceTarget: vi.fn(),
          getSourceCollectorSettings: vi.fn(),
          listSourceCollectorPlugins: () => ok([]),
          listSourceCollections: vi.fn(),
          listPeriodicCrawlTargets: vi.fn(),
          listSources: vi.fn(),
          unsubscribe: vi.fn(),
          updateCollection: vi.fn(),
          updateSourceCollectorSettings: vi.fn(),
        } satisfies SourceService,
      }),
    );

    await expect(
      endpoint({
        description: "Weekly notes",
        title: "Example Feed",
        url: "https://example.com/feed.xml",
      }),
    ).resolves.toMatchObject(
      ok({
        id: "source-1",
        slug: "example-feed",
        title: "Example Feed",
      }),
    );
  });

  it("returns source collections", async () => {
    const endpoint = createListSourceCollectionsEndpoint(
      createTestAppDependencies({
        sourceService: {
          listSourceCollections: vi.fn(() =>
            Promise.resolve(
              ok([
                {
                  createdAt: new Date("2026-06-02T00:00:00.000Z"),
                  id: "collection-1",
                  parentCollectionId: null,
                  position: 0,
                  sourceCount: 1,
                  title: "Work",
                },
              ]),
            ),
          ),
        } as unknown as SourceService,
      }),
    );

    await expect(endpoint()).resolves.toEqual(
      ok([
        {
          createdAt: new Date("2026-06-02T00:00:00.000Z"),
          id: "collection-1",
          parentCollectionId: null,
          position: 0,
          sourceCount: 1,
          title: "Work",
        },
      ]),
    );
  });

  it("creates source collections", async () => {
    const endpoint = createCreateSourceCollectionEndpoint(
      createTestAppDependencies({
        sourceService: {
          createCollection: vi.fn(() =>
            Promise.resolve(
              ok({
                createdAt: new Date("2026-06-02T00:00:00.000Z"),
                id: "collection-1",
                parentCollectionId: null,
                position: 0,
                sourceCount: 0,
                title: "Work",
              }),
            ),
          ),
        } as unknown as SourceService,
      }),
    );

    await expect(
      endpoint({
        parentCollectionId: null,
        position: 0,
        title: "Work",
      }),
    ).resolves.toEqual(
      ok({
        createdAt: new Date("2026-06-02T00:00:00.000Z"),
        id: "collection-1",
        parentCollectionId: null,
        position: 0,
        sourceCount: 0,
        title: "Work",
      }),
    );
  });

  it("updates source collections", async () => {
    const endpoint = createUpdateSourceCollectionEndpoint(
      createTestAppDependencies({
        sourceService: {
          updateCollection: vi.fn(() =>
            Promise.resolve(
              ok({
                createdAt: new Date("2026-06-02T00:00:00.000Z"),
                id: "collection-1",
                parentCollectionId: null,
                position: 1,
                sourceCount: 2,
                title: "Pinned",
              }),
            ),
          ),
        } as unknown as SourceService,
      }),
    );

    await expect(
      endpoint("collection-1", {
        parentCollectionId: null,
        position: 1,
        title: "Pinned",
      }),
    ).resolves.toEqual(
      ok({
        createdAt: new Date("2026-06-02T00:00:00.000Z"),
        id: "collection-1",
        parentCollectionId: null,
        position: 1,
        sourceCount: 2,
        title: "Pinned",
      }),
    );
  });

  it("assigns sources to collections", async () => {
    const endpoint = createAssignSourceToCollectionEndpoint(
      createTestAppDependencies({
        sourceService: {
          assignSourceToCollection: vi.fn(() =>
            Promise.resolve(
              ok({
                collectionId: "collection-1",
                collectorSettingsVersion: 1,
                createdAt: new Date("2026-06-02T00:00:00.000Z"),
                description: "Weekly notes",
                id: "source-1",
                kind: "podcast",
                periodicCrawlEnabled: true,
                periodicCrawlIntervalMinutes: 60,
                recordedAt: new Date("2026-06-02T00:00:00.000Z"),
                slug: "example-feed",
                subscriptionId: "subscription-1",
                subscriptionPosition: 2,
                title: "Example Feed",
                url: "https://example.com/feed.xml",
                urlHash: "hash-1",
                version: 1,
              }),
            ),
          ),
        } as unknown as SourceService,
      }),
    );

    await expect(
      endpoint("source-1", {
        collectionId: "collection-1",
        position: 2,
      }),
    ).resolves.toEqual(
      ok({
        collectionId: "collection-1",
        collectorSettingsVersion: 1,
        createdAt: new Date("2026-06-02T00:00:00.000Z"),
        description: "Weekly notes",
        id: "source-1",
        kind: "podcast",
        periodicCrawlEnabled: true,
        periodicCrawlIntervalMinutes: 60,
        recordedAt: new Date("2026-06-02T00:00:00.000Z"),
        slug: "example-feed",
        subscriptionId: "subscription-1",
        subscriptionPosition: 2,
        title: "Example Feed",
        url: "https://example.com/feed.xml",
        urlHash: "hash-1",
        version: 1,
      }),
    );
  });

  it("unsubscribes subscriptions", async () => {
    const endpoint = createUnsubscribeEndpoint(
      createTestAppDependencies({
        sourceService: {
          unsubscribe: vi.fn(() => Promise.resolve(ok(undefined))),
        } as unknown as SourceService,
      }),
    );

    await expect(endpoint("subscription-1")).resolves.toEqual(ok(undefined));
  });

  it("preserves duplicate-source errors", async () => {
    const endpoint = createCreateSourceEndpoint(
      createTestAppDependencies({
        jobService: {
          enqueueObserveSourceJob: vi.fn(),
        } as unknown as JobService,
        sourceInspectService: {
          inspectSource: vi.fn(),
        },
        sourceService: {
          createSource: vi.fn(() =>
            Promise.resolve({
              error: new DuplicateSourceUrlHashError("hash-1"),
              ok: false,
            } as const),
          ),
          listSources: vi.fn(),
          updateSourceCollectorSettings: vi.fn(),
        } as unknown as SourceService,
      }),
    );

    await expect(
      endpoint({
        url: "https://example.com/feed.xml",
      }),
    ).resolves.toEqual(
      err({
        code: "duplicate_source",
        message: "A source for this source URL already exists.",
      }),
    );
  });

  it("returns source collector settings", async () => {
    const endpoint = createGetSourceCollectorSettingsEndpoint(
      createTestAppDependencies({
        sourceService: {
          getSourceCollectorSettings: vi.fn(() =>
            Promise.resolve(
              ok({
                baseVersion: 3,
                items: [
                  {
                    key: "userAgent",
                    type: {
                      type: "text",
                    },
                    value: "geshi-test",
                  },
                ],
                periodicCrawl: {
                  enabled: true,
                  intervalMinutes: 60,
                },
              }),
            ),
          ),
        } as unknown as SourceService,
      }),
    );

    await expect(endpoint("source-1")).resolves.toEqual(
      ok({
        baseVersion: 3,
        items: [
          {
            key: "userAgent",
            type: {
              type: "text",
            },
            value: "geshi-test",
          },
        ],
        periodicCrawl: {
          enabled: true,
          intervalMinutes: 60,
        },
      }),
    );
  });

  it("maps generic create-source failures", async () => {
    const endpoint = createCreateSourceEndpoint(
      createTestAppDependencies({
        sourceService: {
          createSource: vi.fn(() =>
            Promise.resolve({
              error: new Error("create failed"),
              ok: false,
            } as const),
          ),
          listSources: vi.fn(),
          updateSourceCollectorSettings: vi.fn(),
        } as unknown as SourceService,
      }),
    );

    const result = await endpoint({
      url: "https://example.com/feed.xml",
    });

    assertErr(result);
    expect(result.error).toEqual({
      code: "source_create_failed",
      message: "create failed",
    });
  });

  it("preserves create-source validation errors", async () => {
    const endpoint = createCreateSourceEndpoint(
      createTestAppDependencies({
        sourceService: {
          createSource: vi.fn(() =>
            Promise.resolve(
              err({
                code: "source_url_invalid",
                message: "Source URL is invalid.",
              }),
            ),
          ),
          listSources: vi.fn(),
          updateSourceCollectorSettings: vi.fn(),
        } as unknown as SourceService,
      }),
    );

    const result = await endpoint({
      url: "notaurl",
    });

    assertErr(result);
    expect(result.error).toEqual({
      code: "source_url_invalid",
      message: "Source URL is invalid.",
    });
  });

  it("passes inspect results through unchanged", async () => {
    const endpoint = createInspectSourceEndpoint(
      createTestAppDependencies({
        sourceInspectService: {
          inspectSource: vi.fn(() =>
            Promise.resolve(
              ok({
                description: "desc",
                sourceSlug: "example-feed",
                title: "Example Feed",
                url: "https://example.com/feed.xml",
              }),
            ),
          ),
        } satisfies SourceInspectService,
      }),
    );

    const result = await endpoint({
      url: "https://example.com/feed.xml",
    });

    assertOk(result);
    expect(result.value).toEqual({
      description: "desc",
      sourceSlug: "example-feed",
      title: "Example Feed",
      url: "https://example.com/feed.xml",
    });
  });

  it("passes inspect errors through unchanged", async () => {
    const endpoint = createInspectSourceEndpoint(
      createTestAppDependencies({
        sourceInspectService: {
          inspectSource: vi.fn(() =>
            Promise.resolve(
              err({
                code: "source_inspect_failed" as const,
                message: "boom",
              }),
            ),
          ),
        } satisfies SourceInspectService,
      }),
    );

    const result = await endpoint({
      url: "https://example.com/feed.xml",
    });

    assertErr(result);
    expect(result.error).toEqual({
      code: "source_inspect_failed",
      message: "boom",
    });
  });

  it("passes discovery results through unchanged", async () => {
    const endpoint = createDiscoverSourcesEndpoint(
      createTestAppDependencies({
        sourceDiscoveryService: {
          discoverSources: vi.fn(() =>
            Promise.resolve(
              ok({
                candidates: [
                  {
                    description: "desc",
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
          previewSource: vi.fn(),
        } satisfies SourceDiscoveryService,
      }),
    );

    const result = await endpoint({
      url: "https://example.com/",
    });

    assertOk(result);
    expect(result.value.candidates[0]).toMatchObject({
      pluginSlug: "podcast-rss",
      sourceSlug: "example-feed",
    });
  });

  it("passes preview results through unchanged", async () => {
    const endpoint = createPreviewSourceEndpoint(
      createTestAppDependencies({
        sourceDiscoveryService: {
          discoverSources: vi.fn(),
          previewSource: vi.fn(() =>
            Promise.resolve(
              ok({
                items: [
                  {
                    kind: "episode",
                    publishedAt: null,
                    summary: "Summary",
                    title: "Episode 1",
                  },
                ],
              }),
            ),
          ),
        } satisfies SourceDiscoveryService,
      }),
    );

    const result = await endpoint({
      pluginSlug: "podcast-rss",
      url: "https://example.com/feed.xml",
    });

    assertOk(result);
    expect(result.value.items[0]).toMatchObject({
      title: "Episode 1",
    });
  });

  it("returns enqueued observe jobs", async () => {
    const endpoint = createEnqueueObserveSourceEndpoint(
      createTestAppDependencies(),
    );

    const result = await endpoint("source-1");

    assertOk(result);
    expect(result.value.id).toBe("job-1");
  });

  it("maps generic observe enqueue failures", async () => {
    const endpoint = createEnqueueObserveSourceEndpoint(
      createTestAppDependencies({
        jobService: {
          enqueueObserveSourceJob: vi.fn(() =>
            Promise.resolve({
              error: new Error("queue failed"),
              ok: false,
            } as const),
          ),
          findJobById: vi.fn(),
        } as unknown as JobService,
      }),
    );

    const result = await endpoint("source-1");

    assertErr(result);
    expect(result.error).toEqual({
      code: "observe_enqueue_failed",
      message: "queue failed",
    });
  });

  it("preserves source_not_found while enqueueing observe jobs", async () => {
    const endpoint = createEnqueueObserveSourceEndpoint(
      createTestAppDependencies({
        jobService: {
          enqueueObserveSourceJob: vi.fn(() =>
            Promise.resolve(
              err({
                code: "source_not_found",
                message: "Source not found.",
              }),
            ),
          ),
          findJobById: vi.fn(),
        } as unknown as JobService,
      }),
    );

    const result = await endpoint("missing");

    assertErr(result);
    expect(result.error).toEqual({
      code: "source_not_found",
      message: "Source not found.",
    });
  });

  it("preserves collector-settings conflict errors", async () => {
    const endpoint = createPatchSourceCollectorSettingsEndpoint(
      createTestAppDependencies({
        jobService: {
          enqueueObserveSourceJob: vi.fn(),
        } as unknown as JobService,
        sourceInspectService: {
          inspectSource: vi.fn(),
        },
        sourceService: {
          createSource: vi.fn(),
          listSources: vi.fn(),
          updateSourceCollectorSettings: vi.fn(() =>
            Promise.resolve({
              error: new CollectorSettingsVersionConflictError(),
              ok: false,
            } as const),
          ),
        } as unknown as SourceService,
      }),
    );

    await expect(
      endpoint("source-1", {
        baseVersion: 1,
        enabled: true,
        intervalMinutes: 60,
        items: [],
      }),
    ).resolves.toEqual(
      err({
        code: "collector_settings_conflict",
        message: "Collector settings were updated by another request.",
      }),
    );
  });

  it("maps generic collector-settings update failures", async () => {
    const endpoint = createPatchSourceCollectorSettingsEndpoint(
      createTestAppDependencies({
        sourceService: {
          createSource: vi.fn(),
          listSources: vi.fn(),
          updateSourceCollectorSettings: vi.fn(() =>
            Promise.resolve({
              error: new Error("update failed"),
              ok: false,
            } as const),
          ),
        } as unknown as SourceService,
      }),
    );

    const result = await endpoint("source-1", {
      baseVersion: 1,
      enabled: true,
      intervalMinutes: 60,
      items: [],
    });

    assertErr(result);
    expect(result.error).toEqual({
      code: "collector_settings_update_failed",
      message: "update failed",
    });
  });

  it("preserves source_not_found while updating collector settings", async () => {
    const endpoint = createPatchSourceCollectorSettingsEndpoint(
      createTestAppDependencies({
        sourceService: {
          createSource: vi.fn(),
          listSources: vi.fn(),
          updateSourceCollectorSettings: vi.fn(() =>
            Promise.resolve(
              err({
                code: "source_not_found",
                message: "Source not found.",
              }),
            ),
          ),
        } as unknown as SourceService,
      }),
    );

    const result = await endpoint("missing", {
      baseVersion: 1,
      enabled: true,
      intervalMinutes: 60,
      items: [],
    });

    assertErr(result);
    expect(result.error).toEqual({
      code: "source_not_found",
      message: "Source not found.",
    });
  });

  it("returns updated collector settings", async () => {
    const endpoint = createPatchSourceCollectorSettingsEndpoint(
      createTestAppDependencies(),
    );

    const result = await endpoint("source-1", {
      baseVersion: 1,
      enabled: true,
      intervalMinutes: 60,
      items: [],
    });

    assertOk(result);
    expect(result.value.id).toBe("source-1");
  });
});
