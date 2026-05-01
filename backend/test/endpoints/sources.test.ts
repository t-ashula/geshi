import { describe, expect, it, vi } from "vitest";

import {
  CollectorSettingsVersionConflictError,
  DuplicateSourceUrlHashError,
} from "../../src/db/source-repository.js";
import {
  createCreateSourceEndpoint,
  createEnqueueObserveSourceEndpoint,
  createInspectSourceEndpoint,
  createListSourcesEndpoint,
  createPatchSourceCollectorSettingsEndpoint,
} from "../../src/endpoints/api/v1/sources.js";
import { err, ok } from "../../src/lib/result.js";
import type { JobService } from "../../src/service/job-service.js";
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
          createSource: vi.fn(() =>
            ok({
              collectorSettingsVersion: 1,
              createdAt: new Date("2026-05-01T00:00:00.000Z"),
              description: "Weekly notes",
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
          listSources: vi.fn(),
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
        message: "A source for this RSS URL already exists.",
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
                message: "RSS URL is invalid.",
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
      message: "RSS URL is invalid.",
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
    });

    assertOk(result);
    expect(result.value.id).toBe("source-1");
  });
});
