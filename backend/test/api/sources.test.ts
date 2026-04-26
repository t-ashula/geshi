import { describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import { ContentRepository } from "../../src/db/content-repository.js";
import { JobRepository } from "../../src/db/job-repository.js";
import { SourceRepository } from "../../src/db/source-repository.js";
import type {
  JobPayload,
  JobQueue,
  ObserveSourceJobPayload,
} from "../../src/job-queue/types.js";
import { OBSERVE_SOURCE_JOB_NAME } from "../../src/job-queue/types.js";
import { ContentService } from "../../src/service/content-service.js";
import { JobService } from "../../src/service/job-service.js";
import { SourceService } from "../../src/service/source-service.js";
import {
  createTestDatabase,
  destroyTestDatabase,
} from "../db/test-database.js";

describe("/api/v1/sources", () => {
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

  it("enqueues an observe job for a source", async () => {
    const testDatabase = await createTestDatabase();
    const enqueuedPayloads: ObserveSourceJobPayload[] = [];
    const enqueuedNames: string[] = [];

    try {
      const app = createTestApp(testDatabase, {
        enqueue: (name, payload) => {
          enqueuedNames.push(name);
          enqueuedPayloads.push(payload);

          return Promise.resolve("queue-job-1");
        },
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
        pluginSlug: "podcast-rss",
        sourceId: createdPayload.data.id,
        url: "https://example.com/feed.xml",
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
  },
) {
  const contentRepository = new ContentRepository(testDatabase.database);
  const contentService = new ContentService(contentRepository);
  const jobRepository = new JobRepository(testDatabase.database);
  const sourceRepository = new SourceRepository(testDatabase.database);
  const sourceService = new SourceService(sourceRepository);
  const jobService = new JobService(sourceService, jobRepository, jobQueue);

  return createApp(sourceService, contentService, jobService);
}
