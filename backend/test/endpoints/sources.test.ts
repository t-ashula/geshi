import { describe, expect, it, vi } from "vitest";

import {
  CollectorSettingsVersionConflictError,
  DuplicateSourceUrlHashError,
} from "../../src/db/source-repository.js";
import {
  createCreateSourceEndpoint,
  createPatchSourceCollectorSettingsEndpoint,
} from "../../src/endpoints/api/v1/sources.js";
import { err, ok } from "../../src/lib/result.js";
import type { JobService } from "../../src/service/job-service.js";
import type { SourceService } from "../../src/service/source-service.js";
import { createTestAppDependencies } from "../support/app-dependencies.js";

describe("source endpoints", () => {
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
        } as unknown as SourceService,
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
});
