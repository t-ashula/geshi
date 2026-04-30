import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import { AppSettingRepository } from "../../src/db/app-setting-repository.js";
import { AssetRepository } from "../../src/db/asset-repository.js";
import { ContentRepository } from "../../src/db/content-repository.js";
import { JobRepository } from "../../src/db/job-repository.js";
import { SourceRepository } from "../../src/db/source-repository.js";
import type { JobPayload, JobQueue } from "../../src/job-queue/types.js";
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

describe("/api/v1/contents", () => {
  it("returns content list items with source slugs", async () => {
    const testDatabase = await createTestDatabase();
    const storageRootDir = await mkdtemp(join(tmpdir(), "geshi-contents-api-"));

    try {
      await insertStoredAudioFixture(testDatabase);
      const app = createTestApp(testDatabase, storageRootDir);

      const response = await app.request("/api/v1/contents");

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        data: [
          {
            id: "00000000-0000-0000-0000-000000000200",
            sourceId: "00000000-0000-0000-0000-000000000100",
            sourceSlug: "example-feed",
            status: "stored",
            title: "Episode 1",
          },
        ],
      });
    } finally {
      await destroyTestDatabase(testDatabase);
      await rm(storageRootDir, {
        force: true,
        recursive: true,
      });
    }
  });

  it("returns content detail with asset urls", async () => {
    const testDatabase = await createTestDatabase();
    const storageRootDir = await mkdtemp(
      join(tmpdir(), "geshi-content-detail-"),
    );

    try {
      await insertStoredAudioFixture(testDatabase);
      const app = createTestApp(testDatabase, storageRootDir);

      const response = await app.request(
        "/api/v1/contents/00000000-0000-0000-0000-000000000200",
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        data: {
          id: "00000000-0000-0000-0000-000000000200",
          source: {
            id: "00000000-0000-0000-0000-000000000100",
            slug: "example-feed",
            title: "Example Feed",
          },
          status: "stored",
          title: "Episode 1",
          assets: [
            {
              id: "00000000-0000-0000-0000-000000000300",
              kind: "audio",
              mimeType: "audio/mpeg",
              primary: true,
              url: "/media/assets/00000000-0000-0000-0000-000000000300.mp3",
            },
          ],
        },
      });
    } finally {
      await destroyTestDatabase(testDatabase);
      await rm(storageRootDir, {
        force: true,
        recursive: true,
      });
    }
  });

  it("returns 404 when content detail is missing", async () => {
    const testDatabase = await createTestDatabase();
    const storageRootDir = await mkdtemp(join(tmpdir(), "geshi-content-404-"));

    try {
      const app = createTestApp(testDatabase, storageRootDir);
      const response = await app.request(
        "/api/v1/contents/00000000-0000-0000-0000-000000000999",
      );

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "content_not_found",
          message: "Content was not found.",
        },
      });
    } finally {
      await destroyTestDatabase(testDatabase);
      await rm(storageRootDir, {
        force: true,
        recursive: true,
      });
    }
  });

  it("serves stored media bodies from /media/assets/{asset-id}.{ext}", async () => {
    const testDatabase = await createTestDatabase();
    const storageRootDir = await mkdtemp(join(tmpdir(), "geshi-media-api-"));

    try {
      const storage = new FilesystemStorage(storageRootDir);
      await insertStoredAudioFixture(testDatabase);
      const stored = await storage.put({
        body: new TextEncoder().encode("fake-mp3-body"),
        contentType: "audio/mpeg",
        key: "example-feed/episode-1.mp3",
        overwrite: true,
      });
      if (!stored.ok) {
        throw stored.error;
      }
      const app = createTestApp(testDatabase, storageRootDir);

      const response = await app.request(
        "/media/assets/00000000-0000-0000-0000-000000000300.mp3",
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("audio/mpeg");
      expect(response.headers.get("content-length")).toBe("13");
      await expect(response.text()).resolves.toBe("fake-mp3-body");
    } finally {
      await destroyTestDatabase(testDatabase);
      await rm(storageRootDir, {
        force: true,
        recursive: true,
      });
    }
  });

  it("returns 404 when media extension does not match content type", async () => {
    const testDatabase = await createTestDatabase();
    const storageRootDir = await mkdtemp(join(tmpdir(), "geshi-media-404-"));

    try {
      const storage = new FilesystemStorage(storageRootDir);
      await insertStoredAudioFixture(testDatabase);
      const stored = await storage.put({
        body: new TextEncoder().encode("fake-mp3-body"),
        contentType: "audio/mpeg",
        key: "example-feed/episode-1.mp3",
        overwrite: true,
      });
      if (!stored.ok) {
        throw stored.error;
      }
      const app = createTestApp(testDatabase, storageRootDir);

      const response = await app.request(
        "/media/assets/00000000-0000-0000-0000-000000000300.ogg",
      );

      expect(response.status).toBe(404);
    } finally {
      await destroyTestDatabase(testDatabase);
      await rm(storageRootDir, {
        force: true,
        recursive: true,
      });
    }
  });

  it("returns 404 when stored media asset is missing", async () => {
    const testDatabase = await createTestDatabase();
    const storageRootDir = await mkdtemp(join(tmpdir(), "geshi-media-miss-"));

    try {
      const app = createTestApp(testDatabase, storageRootDir);
      const response = await app.request(
        "/media/assets/00000000-0000-0000-0000-000000000399.mp3",
      );

      expect(response.status).toBe(404);
    } finally {
      await destroyTestDatabase(testDatabase);
      await rm(storageRootDir, {
        force: true,
        recursive: true,
      });
    }
  });
});

function createTestApp(
  testDatabase: Awaited<ReturnType<typeof createTestDatabase>>,
  storageRootDir: string,
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
  const storage = new FilesystemStorage(storageRootDir);

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

async function insertStoredAudioFixture(
  testDatabase: Awaited<ReturnType<typeof createTestDatabase>>,
): Promise<void> {
  await testDatabase.pool.query(
    `
      insert into sources (
        id,
        slug,
        kind,
        url,
        url_hash
      ) values ($1, $2, 'podcast', $3, $4)
    `,
    [
      "00000000-0000-0000-0000-000000000100",
      "example-feed",
      "https://example.com/feed.xml",
      "sha256:feed",
    ],
  );
  await testDatabase.pool.query(
    `
      insert into source_snapshots (
        id,
        source_id,
        version,
        title,
        description
      ) values ($1, $2, 1, $3, $4)
    `,
    [
      "00000000-0000-0000-0000-000000000101",
      "00000000-0000-0000-0000-000000000100",
      "Example Feed",
      "Podcast description",
    ],
  );
  await testDatabase.pool.query(
    `
      insert into contents (
        id,
        source_id,
        external_id,
        content_fingerprint,
        kind,
        status
      ) values ($1, $2, $3, $4, 'episode', 'stored')
    `,
    [
      "00000000-0000-0000-0000-000000000200",
      "00000000-0000-0000-0000-000000000100",
      "ep-1",
      "2026-04-30:episode:ep-1",
    ],
  );
  await testDatabase.pool.query(
    `
      insert into content_snapshots (
        id,
        content_id,
        version,
        title,
        summary
      ) values ($1, $2, 1, $3, $4)
    `,
    [
      "00000000-0000-0000-0000-000000000201",
      "00000000-0000-0000-0000-000000000200",
      "Episode 1",
      "Episode summary",
    ],
  );
  await testDatabase.pool.query(
    `
      insert into assets (
        id,
        content_id,
        kind,
        is_primary,
        observed_fingerprint,
        acquired_fingerprint,
        acquired_at
      ) values ($1, $2, 'audio', true, $3, $4, current_timestamp)
    `,
    [
      "00000000-0000-0000-0000-000000000300",
      "00000000-0000-0000-0000-000000000200",
      "2026-04-30:audio:https://cdn.example.com/audio/1.mp3",
      "2026-04-30:audio:sha256:asset-1",
    ],
  );
  await testDatabase.pool.query(
    `
      insert into asset_snapshots (
        id,
        asset_id,
        version,
        source_url,
        storage_key,
        mime_type,
        byte_size,
        checksum
      ) values ($1, $2, 1, $3, $4, $5, $6, $7)
    `,
    [
      "00000000-0000-0000-0000-000000000301",
      "00000000-0000-0000-0000-000000000300",
      "https://cdn.example.com/audio/1.mp3",
      "example-feed/episode-1.mp3",
      "audio/mpeg",
      13,
      "sha256:body",
    ],
  );
}
