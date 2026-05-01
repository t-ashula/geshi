import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import {
  CollectorSettingsVersionConflictError,
  DuplicateSourceUrlHashError,
} from "../../src/db/source-repository.js";
import {
  createCreateSourceHandler,
  createPatchSourceCollectorSettingsHandler,
} from "../../src/handlers/api/v1/sources.js";
import { ok } from "../../src/lib/result.js";
import type { JobService } from "../../src/service/job-service.js";
import type { SourceService } from "../../src/service/source-service.js";
import { createTestAppDependencies } from "../support/app-dependencies.js";

describe("source handlers", () => {
  it("returns the current create-source response on success", async () => {
    const handler = createCreateSourceHandler(
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
    const app = new Hono();
    app.post("/", handler);

    const response = await app.request("/", {
      body: JSON.stringify({
        description: "Weekly notes",
        title: "Example Feed",
        url: "https://example.com/feed.xml",
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        id: "source-1",
        slug: "example-feed",
        title: "Example Feed",
      },
    });
  });

  it("preserves duplicate-source errors", async () => {
    const handler = createCreateSourceHandler(
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
              ok: false,
              error: new DuplicateSourceUrlHashError("hash-1"),
            } as const),
          ),
          listSources: vi.fn(),
          updateSourceCollectorSettings: vi.fn(),
        } as unknown as SourceService,
      }),
    );
    const app = new Hono();
    app.post("/", handler);

    const response = await app.request("/", {
      body: JSON.stringify({
        url: "https://example.com/feed.xml",
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "duplicate_source",
        message: "A source for this RSS URL already exists.",
      },
    });
  });

  it("preserves collector-settings conflict errors", async () => {
    const handler = createPatchSourceCollectorSettingsHandler(
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
              ok: false,
              error: new CollectorSettingsVersionConflictError(),
            } as const),
          ),
        } as unknown as SourceService,
      }),
    );
    const app = new Hono();
    app.patch("/:sourceId/collector-settings", handler);

    const response = await app.request("/source-1/collector-settings", {
      body: JSON.stringify({
        baseVersion: 1,
        enabled: true,
        intervalMinutes: 60,
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "PATCH",
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "collector_settings_conflict",
        message: "Collector settings were updated by another request.",
      },
    });
  });
});
