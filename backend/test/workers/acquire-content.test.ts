import { afterEach, describe, expect, it, vi } from "vitest";

import { AssetRepository } from "../../src/db/asset-repository.js";
import { ContentRepository } from "../../src/db/content-repository.js";
import { JobRepository } from "../../src/db/job-repository.js";
import { SourceRepository } from "../../src/db/source-repository.js";
import { createNoopLogger } from "../../src/logger/index.js";
import { AssetService } from "../../src/service/asset-service.js";
import { ContentService } from "../../src/service/content-service.js";
import { FilesystemStorage } from "../../src/storage/filesystem-storage.js";
import { handleAcquireContentJob } from "../../src/workers/acquire-content/handle.js";
import {
  createTestDatabase,
  destroyTestDatabase,
} from "../db/test-database.js";

describe("handleAcquireContentJob", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("acquires pending assets, stores them, and marks the job as succeeded", async () => {
    const testDatabase = await createTestDatabase();

    try {
      const sourceRepository = new SourceRepository(testDatabase.database);
      const assetRepository = new AssetRepository(testDatabase.database);
      const contentRepository = new ContentRepository(testDatabase.database);
      const jobRepository = new JobRepository(testDatabase.database);
      const assetService = new AssetService(assetRepository);
      const contentService = new ContentService(contentRepository);
      const storage = new FilesystemStorage("/tmp/geshi-storage-test");
      const source = await sourceRepository.createSource({
        collectorSettingId: crypto.randomUUID(),
        collectorSettingSnapshotId: crypto.randomUUID(),
        id: crypto.randomUUID(),
        kind: "podcast",
        pluginSlug: "podcast-rss",
        slug: "source-one",
        snapshotId: crypto.randomUUID(),
        url: "https://example.com/feed.xml",
        urlHash: "hash-1",
      });
      const content = await contentService.createObservedContent({
        contentFingerprints: ["2026-04-28:ep-1"],
        externalId: "ep-1",
        kind: "podcast-episode",
        publishedAt: new Date("2024-01-01T00:00:00Z"),
        sourceId: source.id,
        status: "discovered",
        summary: "Hello",
        title: "Episode 1",
      });

      await assetService.createObservedAssets([
        {
          contentFingerprintChanged: false,
          contentId: content.id,
          kind: "html",
          observedFingerprints: [
            "2026-04-28:html:https://example.com/episodes/1",
          ],
          primary: true,
          sourceUrl: "https://example.com/episodes/1",
        },
        {
          contentFingerprintChanged: false,
          contentId: content.id,
          kind: "audio",
          observedFingerprints: [
            "2026-04-28:audio:https://cdn.example.com/audio/1.mp3",
          ],
          primary: false,
          sourceUrl: "https://cdn.example.com/audio/1.mp3",
        },
      ]);
      const createdAssets = await assetRepository.listAssets();
      const firstAssetId = createdAssets[0]?.id;

      const jobId = crypto.randomUUID();

      await jobRepository.createJob({
        id: jobId,
        kind: "acquire-content",
        retryable: true,
        sourceId: source.id,
      });

      vi.stubGlobal(
        "fetch",
        vi.fn((input: string | URL | Request) => {
          const url =
            typeof input === "string"
              ? input
              : input instanceof URL
                ? input.toString()
                : input.url;

          if (url === "https://example.com/episodes/1") {
            return Promise.resolve(
              new Response("<html>Episode 1</html>", {
                headers: {
                  "content-type": "text/html",
                },
                status: 200,
              }),
            );
          }

          if (url === "https://cdn.example.com/audio/1.mp3") {
            return Promise.resolve(
              new Response(new Uint8Array([1, 2, 3]), {
                headers: {
                  "content-type": "audio/mpeg",
                },
                status: 200,
              }),
            );
          }

          return Promise.reject(new Error(`Unexpected fetch url: ${url}`));
        }),
      );

      if (firstAssetId === undefined) {
        throw new Error("Expected at least one asset.");
      }

      await handleAcquireContentJob(
        {
          assetId: firstAssetId,
          collectorSettingId: "setting-1",
          collectorSettingSnapshotId: "setting-snapshot-1",
          config: {},
          contentId: content.id,
          jobId,
          pluginSlug: "podcast-rss",
          sourceId: source.id,
        },
        {
          assetService,
          contentService,
          jobRepository,
          logger: createNoopLogger(),
          storage,
        },
      );

      const assets = await assetRepository.listAssets();
      const updatedAsset = assets.find((asset) => asset.id === firstAssetId);
      const contents = await contentRepository.listContents();
      const job = await jobRepository.findJobById(jobId);

      expect(contents[0]?.status).toBe("stored");
      expect(updatedAsset?.storageKey).not.toBeNull();
      expect(updatedAsset?.acquiredAt instanceof Date).toBe(true);
      expect(updatedAsset?.checksum?.startsWith("sha256:")).toBe(true);
      expect(updatedAsset?.acquiredFingerprint?.startsWith("2026-04-28:")).toBe(
        true,
      );
      expect(job?.status).toBe("succeeded");
    } finally {
      await destroyTestDatabase(testDatabase);
    }
  });

  it("marks the job and content as failed when asset fetch fails", async () => {
    const testDatabase = await createTestDatabase();

    try {
      const sourceRepository = new SourceRepository(testDatabase.database);
      const assetRepository = new AssetRepository(testDatabase.database);
      const contentRepository = new ContentRepository(testDatabase.database);
      const jobRepository = new JobRepository(testDatabase.database);
      const assetService = new AssetService(assetRepository);
      const contentService = new ContentService(contentRepository);
      const storage = new FilesystemStorage("/tmp/geshi-storage-test");
      const source = await sourceRepository.createSource({
        collectorSettingId: crypto.randomUUID(),
        collectorSettingSnapshotId: crypto.randomUUID(),
        id: crypto.randomUUID(),
        kind: "podcast",
        pluginSlug: "podcast-rss",
        slug: "source-two",
        snapshotId: crypto.randomUUID(),
        url: "https://example.com/feed.xml",
        urlHash: "hash-2",
      });
      const content = await contentService.createObservedContent({
        contentFingerprints: ["2026-04-28:ep-2"],
        externalId: "ep-2",
        kind: "podcast-episode",
        publishedAt: new Date("2024-01-02T00:00:00Z"),
        sourceId: source.id,
        status: "discovered",
        summary: "World",
        title: "Episode 2",
      });

      await assetService.createObservedAssets([
        {
          contentFingerprintChanged: false,
          contentId: content.id,
          kind: "audio",
          observedFingerprints: [
            "2026-04-28:audio:https://cdn.example.com/audio/2.mp3",
          ],
          primary: false,
          sourceUrl: "https://cdn.example.com/audio/2.mp3",
        },
      ]);
      const asset = (await assetRepository.listAssets())[0];
      const jobId = crypto.randomUUID();

      await jobRepository.createJob({
        id: jobId,
        kind: "acquire-content",
        retryable: true,
        sourceId: source.id,
      });
      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          Promise.resolve(
            new Response("bad gateway", {
              status: 502,
            }),
          ),
        ),
      );

      await expect(
        handleAcquireContentJob(
          {
            assetId: asset.id,
            collectorSettingId: "setting-2",
            collectorSettingSnapshotId: "setting-snapshot-2",
            config: {},
            contentId: content.id,
            jobId,
            pluginSlug: "podcast-rss",
            sourceId: source.id,
          },
          {
            assetService,
            contentService,
            jobRepository,
            logger: createNoopLogger(),
            storage,
          },
        ),
      ).rejects.toThrow("Failed to fetch asset: 502");

      const storedContent = await contentRepository.findContentAcquireTarget(
        content.id,
      );
      const job = await jobRepository.findJobById(jobId);

      expect(storedContent?.status).toBe("failed");
      expect(job?.status).toBe("failed");
      expect(job?.failureMessage).toContain("Failed to fetch asset: 502");
      expect(job?.retryable).toBe(true);
    } finally {
      await destroyTestDatabase(testDatabase);
    }
  });

  it("marks the job and content as failed when the asset sourceUrl is missing", async () => {
    const testDatabase = await createTestDatabase();

    try {
      const sourceRepository = new SourceRepository(testDatabase.database);
      const assetRepository = new AssetRepository(testDatabase.database);
      const contentRepository = new ContentRepository(testDatabase.database);
      const jobRepository = new JobRepository(testDatabase.database);
      const assetService = new AssetService(assetRepository);
      const contentService = new ContentService(contentRepository);
      const storage = new FilesystemStorage("/tmp/geshi-storage-test");
      const source = await sourceRepository.createSource({
        collectorSettingId: crypto.randomUUID(),
        collectorSettingSnapshotId: crypto.randomUUID(),
        id: crypto.randomUUID(),
        kind: "podcast",
        pluginSlug: "podcast-rss",
        slug: "source-three",
        snapshotId: crypto.randomUUID(),
        url: "https://example.com/feed.xml",
        urlHash: "hash-3",
      });
      const content = await contentService.createObservedContent({
        contentFingerprints: ["2026-04-28:ep-3"],
        externalId: "ep-3",
        kind: "podcast-episode",
        publishedAt: new Date("2024-01-03T00:00:00Z"),
        sourceId: source.id,
        status: "discovered",
        summary: "Missing sourceUrl",
        title: "Episode 3",
      });

      await assetService.createObservedAssets([
        {
          contentFingerprintChanged: false,
          contentId: content.id,
          kind: "audio",
          observedFingerprints: ["2026-04-28:audio:null"],
          primary: false,
          sourceUrl: null,
        },
      ]);
      const asset = (await assetRepository.listAssets())[0];
      const jobId = crypto.randomUUID();

      await jobRepository.createJob({
        id: jobId,
        kind: "acquire-content",
        retryable: true,
        sourceId: source.id,
      });

      await expect(
        handleAcquireContentJob(
          {
            assetId: asset.id,
            collectorSettingId: "setting-3",
            collectorSettingSnapshotId: "setting-snapshot-3",
            config: {},
            contentId: content.id,
            jobId,
            pluginSlug: "podcast-rss",
            sourceId: source.id,
          },
          {
            assetService,
            contentService,
            jobRepository,
            logger: createNoopLogger(),
            storage,
          },
        ),
      ).rejects.toThrow("Podcast RSS asset sourceUrl is required.");

      const storedContent = await contentRepository.findContentAcquireTarget(
        content.id,
      );
      const job = await jobRepository.findJobById(jobId);

      expect(storedContent?.status).toBe("failed");
      expect(job?.status).toBe("failed");
      expect(job?.failureMessage).toContain(
        "Podcast RSS asset sourceUrl is required.",
      );
      expect(job?.retryable).toBe(true);
    } finally {
      await destroyTestDatabase(testDatabase);
    }
  });
});
