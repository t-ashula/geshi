import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AssetRepository } from "../../src/db/asset-repository.js";
import { ContentRepository } from "../../src/db/content-repository.js";
import { JobRepository } from "../../src/db/job-repository.js";
import { SourceRepository } from "../../src/db/source-repository.js";
import type { JobPayload } from "../../src/job-queue/types.js";
import type { AcquireContentJobPayload } from "../../src/job-queue/types.js";
import { ACQUIRE_CONTENT_JOB_NAME } from "../../src/job-queue/types.js";
import { createNoopLogger } from "../../src/logger/index.js";
import { AssetService } from "../../src/service/asset-service.js";
import { ContentService } from "../../src/service/content-service.js";
import { handleObserveSourceJob } from "../../src/workers/observe-source/handle.js";
import {
  createTestDatabase,
  destroyTestDatabase,
} from "../db/test-database.js";

describe("handleObserveSourceJob", () => {
  let testDatabase: Awaited<ReturnType<typeof createTestDatabase>>;

  beforeEach(async () => {
    testDatabase = await createTestDatabase();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await destroyTestDatabase(testDatabase);
  });

  it("imports observed contents, creates assets, and enqueues acquire jobs", async () => {
    const sourceRepository = new SourceRepository(testDatabase.database);
    const assetRepository = new AssetRepository(testDatabase.database);
    const contentRepository = new ContentRepository(testDatabase.database);
    const jobRepository = new JobRepository(testDatabase.database);
    const assetService = new AssetService(assetRepository);
    const contentService = new ContentService(contentRepository);
    const enqueuedJobs: Array<{ name: string; payload: JobPayload }> = [];
    let queueJobSequence = 0;
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

    const jobId = crypto.randomUUID();

    await jobRepository.createJob({
      id: jobId,
      kind: "observe-source",
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

        if (url === "https://example.com/feed.xml") {
          return Promise.resolve(
            new Response(
              `<?xml version="1.0"?><rss><channel><item><guid>ep-1</guid><title>Episode 1</title><description>Hello</description><link>https://example.com/episodes/1</link><enclosure url="https://cdn.example.com/audio/1.mp3" /><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate></item></channel></rss>`,
              {
                status: 200,
              },
            ),
          );
        }

        return Promise.reject(new Error(`Unexpected fetch url: ${url}`));
      }),
    );

    await handleObserveSourceJob(
      {
        collector: {
          config: {},
          pluginSlug: "podcast-rss",
          settingId: "setting-1",
          settingSnapshotId: "setting-snapshot-1",
        },
        jobId,
        source: {
          id: source.id,
          kind: "podcast",
          slug: source.slug,
          url: source.url,
        },
      },
      {
        assetService,
        contentService,
        jobQueue: {
          enqueue: (name, payload) => {
            enqueuedJobs.push({ name, payload });
            queueJobSequence += 1;

            return Promise.resolve(`queue-job-${queueJobSequence}`);
          },
        },
        jobRepository,
        logger: createNoopLogger(),
      },
    );

    const assets = await assetRepository.listAssets();
    const contents = await contentRepository.listContents();
    const job = await jobRepository.findJobById(jobId);

    expect(contents).toHaveLength(1);
    expect(contents[0]).toMatchObject({
      sourceId: source.id,
      status: "discovered",
      title: "Episode 1",
    });
    expect(assets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          acquiredAt: null,
          acquiredFingerprint: null,
          contentId: contents[0].id,
          kind: "html",
          primary: true,
          sourceUrl: "https://example.com/episodes/1",
        }),
        expect.objectContaining({
          acquiredAt: null,
          acquiredFingerprint: null,
          contentId: contents[0].id,
          kind: "audio",
          primary: false,
          sourceUrl: "https://cdn.example.com/audio/1.mp3",
        }),
      ]),
    );
    expect(
      assets.every((asset) =>
        /^2026-04-28:[0-9a-f]{64}$/.test(asset.observedFingerprint),
      ),
    ).toBe(true);
    expect(assets.every((asset) => asset.storageKey === null)).toBe(true);
    expect(enqueuedJobs).toHaveLength(2);
    expect(
      enqueuedJobs.every((job) => job.name === ACQUIRE_CONTENT_JOB_NAME),
    ).toBe(true);
    const acquirePayload = enqueuedJobs[0]?.payload as
      | AcquireContentJobPayload
      | undefined;

    expect(acquirePayload).toMatchObject({
      asset: {
        id: assets.find((asset) => asset.kind === "html")?.id,
        kind: "html",
        primary: true,
        sourceUrl: "https://example.com/episodes/1",
      },
      collector: {
        config: {},
        pluginSlug: "podcast-rss",
        settingId: "setting-1",
        settingSnapshotId: "setting-snapshot-1",
      },
      content: {
        externalId: "ep-1",
        id: contents[0].id,
        kind: "podcast-episode",
        status: "discovered",
        summary: "Hello",
        title: "Episode 1",
      },
      source: {
        id: source.id,
        slug: source.slug,
      },
    });
    expect(
      enqueuedJobs.map(
        (job) => (job.payload as AcquireContentJobPayload).asset.id,
      ),
    ).toEqual(expect.arrayContaining(assets.map((asset) => asset.id)));
    expect(job?.status).toBe("succeeded");
  });

  it("marks the job as failed when feed fetch fails", async () => {
    const sourceRepository = new SourceRepository(testDatabase.database);
    const assetRepository = new AssetRepository(testDatabase.database);
    const jobRepository = new JobRepository(testDatabase.database);
    const source = await sourceRepository.createSource({
      collectorSettingId: crypto.randomUUID(),
      collectorSettingSnapshotId: crypto.randomUUID(),
      id: crypto.randomUUID(),
      kind: "podcast",
      pluginSlug: "podcast-rss",
      slug: "source-two",
      snapshotId: crypto.randomUUID(),
      url: "https://example.com/fail.xml",
      urlHash: "hash-2",
    });

    const jobId = crypto.randomUUID();

    await jobRepository.createJob({
      id: jobId,
      kind: "observe-source",
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
      handleObserveSourceJob(
        {
          collector: {
            config: {},
            pluginSlug: "podcast-rss",
            settingId: "setting-2",
            settingSnapshotId: "setting-snapshot-2",
          },
          jobId,
          source: {
            id: source.id,
            kind: "podcast",
            slug: source.slug,
            url: source.url,
          },
        },
        {
          assetService: new AssetService(assetRepository),
          contentService: new ContentService(
            new ContentRepository(testDatabase.database),
          ),
          jobQueue: {
            enqueue: () => Promise.resolve("queue-job-test"),
          },
          jobRepository,
          logger: createNoopLogger(),
        },
      ),
    ).rejects.toThrow("Failed to fetch RSS feed: 502");

    const job = await jobRepository.findJobById(jobId);

    expect(job?.status).toBe("failed");
    expect(job?.failureMessage).toContain("Failed to fetch RSS feed: 502");
  });
});
