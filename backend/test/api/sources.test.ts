import { describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import { SourceRepository } from "../../src/db/source-repository.js";
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
});

function createTestApp(
  testDatabase: Awaited<ReturnType<typeof createTestDatabase>>,
) {
  const sourceRepository = new SourceRepository(testDatabase.database);
  const sourceService = new SourceService(sourceRepository);

  return createApp(sourceService);
}
