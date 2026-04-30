import { afterEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../../src/app.js";
import { AppSettingRepository } from "../../src/db/app-setting-repository.js";
import { AssetRepository } from "../../src/db/asset-repository.js";
import { ContentRepository } from "../../src/db/content-repository.js";
import { JobRepository } from "../../src/db/job-repository.js";
import { SourceRepository } from "../../src/db/source-repository.js";
import type { JobPayload, JobQueue } from "../../src/job-queue/types.js";
import type { ObserveSourceJobPayload } from "../../src/job-queue/types.js";
import { OBSERVE_SOURCE_JOB_NAME } from "../../src/job-queue/types.js";
import { AppSettingService } from "../../src/service/app-setting-service.js";
import { AssetService } from "../../src/service/asset-service.js";
import { ContentService } from "../../src/service/content-service.js";
import { JobService } from "../../src/service/job-service.js";
import { SourceInspectService } from "../../src/service/source-inspect-service.js";
import { SourceService } from "../../src/service/source-service.js";
import { FilesystemStorage } from "../../src/storage/filesystem-storage.js";
import {
  createTestDatabase,
  destroyTestDatabase,
} from "../db/test-database.js";

describe("/api/v1/sources", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns an empty source list", async () => {
    const testDatabase = await createTestDatabase();

    try {
      const app = createTestApp(testDatabase);
      const response = await app.request("/api/v1/sources");

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        data: [],
      });
    } finally {
      await destroyTestDatabase(testDatabase);
    }
  });

  it("creates a source and returns it", async () => {
    const testDatabase = await createTestDatabase();

    try {
      const app = createTestApp(testDatabase);
      const response = await app.request("/api/v1/sources", {
        body: JSON.stringify({
          description: "Weekly notes",
          title: "Example Podcast",
          url: "https://example.com/feed.xml",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      });

      expect(response.status).toBe(201);

      const payload = (await response.json()) as {
        data: {
          description: string | null;
          kind: string;
          slug: string;
          title: string | null;
          url: string;
          version: number | null;
        };
      };

      expect(payload.data.kind).toBe("podcast");
      expect(payload.data.url).toBe("https://example.com/feed.xml");
      expect(payload.data.title).toBe("Example Podcast");
      expect(payload.data.description).toBe("Weekly notes");
      expect(payload.data.version).toBe(1);
      expect(payload.data.slug).toMatch(/^example-podcast-/);
    } finally {
      await destroyTestDatabase(testDatabase);
    }
  });

  it("creates a source with inspected slug", async () => {
    const testDatabase = await createTestDatabase();

    try {
      const app = createTestApp(testDatabase);
      const response = await app.request("/api/v1/sources", {
        body: JSON.stringify({
          description: "Weekly notes",
          sourceSlug: "inspected-slug",
          title: "Example Podcast",
          url: "https://example.com/feed.xml",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      });

      expect(response.status).toBe(201);

      const payload = (await response.json()) as {
        data: {
          slug: string;
        };
      };

      expect(payload.data.slug).toBe("inspected-slug");
    } finally {
      await destroyTestDatabase(testDatabase);
    }
  });

  it("inspects a source and returns metadata", async () => {
    const testDatabase = await createTestDatabase();

    try {
      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          Promise.resolve(
            new Response(
              `<?xml version="1.0"?>
              <rss>
                <channel>
                  <title>Example Podcast</title>
                  <description>Weekly notes</description>
                </channel>
              </rss>`,
              { status: 200 },
            ),
          ),
        ),
      );
      const app = createTestApp(testDatabase);
      const response = await app.request("/api/v1/sources/inspect", {
        body: JSON.stringify({
          url: "https://example.com/feed.xml",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      });

      expect(response.status).toBe(200);
      const payload = (await response.json()) as {
        data: {
          description: string;
          sourceSlug: string;
          title: string;
          url: string;
        };
      };

      expect(payload).toMatchObject({
        data: {
          description: "Weekly notes",
          title: "Example Podcast",
          url: "https://example.com/feed.xml",
        },
      });
      expect(payload.data.sourceSlug).toMatch(/^example-podcast-/);
    } finally {
      await destroyTestDatabase(testDatabase);
    }
  });

  it("rejects empty urls", async () => {
    const testDatabase = await createTestDatabase();

    try {
      const app = createTestApp(testDatabase);
      const response = await app.request("/api/v1/sources", {
        body: JSON.stringify({
          url: "   ",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      });

      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "source_url_required",
          message: "RSS URL is required.",
        },
      });
    } finally {
      await destroyTestDatabase(testDatabase);
    }
  });

  it("rejects invalid urls", async () => {
    const testDatabase = await createTestDatabase();

    try {
      const app = createTestApp(testDatabase);
      const response = await app.request("/api/v1/sources", {
        body: JSON.stringify({
          url: "ftp://example.com/feed.xml",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      });

      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "source_url_invalid",
          message: "RSS URL must be an absolute http or https URL.",
        },
      });
    } finally {
      await destroyTestDatabase(testDatabase);
    }
  });

  it("rejects duplicate urls", async () => {
    const testDatabase = await createTestDatabase();

    try {
      const app = createTestApp(testDatabase);
      const request = {
        body: JSON.stringify({
          url: "https://example.com/feed.xml",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      } as const;

      const firstResponse = await app.request("/api/v1/sources", request);
      const secondResponse = await app.request("/api/v1/sources", request);

      expect(firstResponse.status).toBe(201);
      expect(secondResponse.status).toBe(409);
      await expect(secondResponse.json()).resolves.toEqual({
        error: {
          code: "duplicate_source",
          message: "A source for this RSS URL already exists.",
        },
      });
    } finally {
      await destroyTestDatabase(testDatabase);
    }
  });

  it("returns inspect errors from the plugin", async () => {
    const testDatabase = await createTestDatabase();

    try {
      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          Promise.resolve(new Response("<html></html>", { status: 200 })),
        ),
      );
      const app = createTestApp(testDatabase);
      const response = await app.request("/api/v1/sources/inspect", {
        body: JSON.stringify({
          url: "https://example.com/not-rss",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      });

      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "source_inspect_unrecognized",
          message: "The given URL is not a supported RSS feed.",
        },
      });
    } finally {
      await destroyTestDatabase(testDatabase);
    }
  });

  it("enqueues an observe job for a source", async () => {
    const testDatabase = await createTestDatabase();
    const enqueuedPayloads: ObserveSourceJobPayload[] = [];
    const enqueuedNames: string[] = [];

    try {
      const app = createTestApp(testDatabase, {
        enqueue: (name, payload) => {
          enqueuedNames.push(name);
          enqueuedPayloads.push(payload as ObserveSourceJobPayload);

          return Promise.resolve("queue-job-1");
        },
        enqueueAfter: (_name, _payload, _startAfter) =>
          Promise.resolve("queue-job-after"),
      });

      const createResponse = await app.request("/api/v1/sources", {
        body: JSON.stringify({
          url: "https://example.com/feed.xml",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      });
      const createdPayload = (await createResponse.json()) as {
        data: {
          id: string;
        };
      };
      const observeResponse = await app.request(
        `/api/v1/sources/${createdPayload.data.id}/observe`,
        {
          method: "POST",
        },
      );

      expect(observeResponse.status).toBe(202);

      const observePayload = (await observeResponse.json()) as {
        data: {
          kind: string;
          queueJobId: string | null;
          sourceId: string | null;
          status: string;
        };
      };

      expect(observePayload.data.kind).toBe("observe-source");
      expect(observePayload.data.queueJobId).toBe("queue-job-1");
      expect(observePayload.data.sourceId).toBe(createdPayload.data.id);
      expect(observePayload.data.status).toBe("queued");
      expect(enqueuedNames).toEqual([OBSERVE_SOURCE_JOB_NAME]);
      expect(enqueuedPayloads).toHaveLength(1);
      expect(enqueuedPayloads[0]).toMatchObject({
        collector: {
          pluginSlug: "podcast-rss",
        },
        source: {
          id: createdPayload.data.id,
          url: "https://example.com/feed.xml",
        },
      });
    } finally {
      await destroyTestDatabase(testDatabase);
    }
  });

  it("returns 404 when observe target source is missing", async () => {
    const testDatabase = await createTestDatabase();

    try {
      const app = createTestApp(testDatabase);
      const response = await app.request(
        "/api/v1/sources/00000000-0000-0000-0000-000000000000/observe",
        {
          method: "POST",
        },
      );

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "source_not_found",
          message: "Source not found.",
        },
      });
    } finally {
      await destroyTestDatabase(testDatabase);
    }
  });

  it("updates source crawl settings", async () => {
    const testDatabase = await createTestDatabase();

    try {
      const app = createTestApp(testDatabase);
      const createResponse = await app.request("/api/v1/sources", {
        body: JSON.stringify({
          url: "https://example.com/feed.xml",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      });
      const createdPayload = (await createResponse.json()) as {
        data: {
          collectorSettingsVersion: number;
          periodicCrawlEnabled: boolean;
          periodicCrawlIntervalMinutes: number;
          id: string;
        };
      };
      const updateResponse = await app.request(
        `/api/v1/sources/${createdPayload.data.id}/collector-settings`,
        {
          body: JSON.stringify({
            baseVersion: createdPayload.data.collectorSettingsVersion,
            enabled: true,
            intervalMinutes: 90,
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "PATCH",
        },
      );

      expect(createdPayload.data.periodicCrawlEnabled).toBe(true);
      expect(createdPayload.data.periodicCrawlIntervalMinutes).toBe(60);
      expect(updateResponse.status).toBe(200);
      await expect(updateResponse.json()).resolves.toMatchObject({
        data: {
          collectorSettingsVersion: 2,
          periodicCrawlEnabled: true,
          periodicCrawlIntervalMinutes: 90,
          id: createdPayload.data.id,
        },
      });
    } finally {
      await destroyTestDatabase(testDatabase);
    }
  });

  it("rejects stale collector settings updates", async () => {
    const testDatabase = await createTestDatabase();

    try {
      const app = createTestApp(testDatabase);
      const createResponse = await app.request("/api/v1/sources", {
        body: JSON.stringify({
          url: "https://example.com/feed.xml",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      });
      const createdPayload = (await createResponse.json()) as {
        data: {
          collectorSettingsVersion: number;
          id: string;
        };
      };
      const firstUpdateResponse = await app.request(
        `/api/v1/sources/${createdPayload.data.id}/collector-settings`,
        {
          body: JSON.stringify({
            baseVersion: createdPayload.data.collectorSettingsVersion,
            enabled: true,
            intervalMinutes: 90,
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "PATCH",
        },
      );
      const staleUpdateResponse = await app.request(
        `/api/v1/sources/${createdPayload.data.id}/collector-settings`,
        {
          body: JSON.stringify({
            baseVersion: createdPayload.data.collectorSettingsVersion,
            enabled: false,
            intervalMinutes: 120,
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "PATCH",
        },
      );

      expect(firstUpdateResponse.status).toBe(200);
      expect(staleUpdateResponse.status).toBe(409);
      await expect(staleUpdateResponse.json()).resolves.toEqual({
        error: {
          code: "collector_settings_conflict",
          message: "Collector settings were updated by another request.",
        },
      });
    } finally {
      await destroyTestDatabase(testDatabase);
    }
  });

  it("returns 404 when updating crawl settings for a missing source", async () => {
    const testDatabase = await createTestDatabase();

    try {
      const app = createTestApp(testDatabase);
      const response = await app.request(
        "/api/v1/sources/00000000-0000-0000-0000-000000000000/collector-settings",
        {
          body: JSON.stringify({
            baseVersion: 1,
            enabled: true,
            intervalMinutes: 90,
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "PATCH",
        },
      );

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "source_not_found",
          message: "Source not found.",
        },
      });
    } finally {
      await destroyTestDatabase(testDatabase);
    }
  });
});

function createTestApp(
  testDatabase: Awaited<ReturnType<typeof createTestDatabase>>,
  jobQueue: JobQueue = {
    enqueue: (_name: string, _payload: JobPayload) =>
      Promise.resolve("queue-job-test"),
    enqueueAfter: (_name: string, _payload: JobPayload, _startAfter: Date) =>
      Promise.resolve("queue-job-test"),
  },
) {
  const assetRepository = new AssetRepository(testDatabase.database);
  const assetService = new AssetService(assetRepository);
  const contentRepository = new ContentRepository(testDatabase.database);
  const contentService = new ContentService(contentRepository);
  const jobRepository = new JobRepository(testDatabase.database);
  const appSettingRepository = new AppSettingRepository(testDatabase.database);
  const appSettingService = new AppSettingService(appSettingRepository);
  const sourceRepository = new SourceRepository(testDatabase.database);
  const sourceService = new SourceService(sourceRepository);
  const sourceInspectService = new SourceInspectService();
  const jobService = new JobService(sourceService, jobRepository, jobQueue);
  const storage = new FilesystemStorage("/tmp/geshi-test-storage");

  return createApp(
    sourceService,
    sourceInspectService,
    assetService,
    contentService,
    jobService,
    appSettingService,
    storage,
  );
}
