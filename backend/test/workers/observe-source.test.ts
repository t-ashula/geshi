import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ContentRepository } from "../../src/db/content-repository.js";
import { JobRepository } from "../../src/db/job-repository.js";
import { SourceRepository } from "../../src/db/source-repository.js";
import { ContentService } from "../../src/service/content-service.js";
import { handleObserveSourceJob } from "../../src/workers/observe-source/handle.js";
import {
  createTestDatabase,
  destroyTestDatabase,
} from "../db/test-database.js";

describe("handleObserveSourceJob", () => {
  let testDatabase: Awaited<ReturnType<typeof createTestDatabase>>;
  let tmpRootDir: string;

  beforeEach(async () => {
    testDatabase = await createTestDatabase();
    tmpRootDir = await mkdtemp(join(tmpdir(), "geshi-observe-test-"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await destroyTestDatabase(testDatabase);
  });

  it("imports observed contents and marks the job as succeeded", async () => {
    const sourceRepository = new SourceRepository(testDatabase.database);
    const contentRepository = new ContentRepository(testDatabase.database);
    const jobRepository = new JobRepository(testDatabase.database);
    const contentService = new ContentService(contentRepository);
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
      vi.fn(() =>
        Promise.resolve(
          new Response(
            `<?xml version="1.0"?><rss><channel><item><guid>ep-1</guid><title>Episode 1</title><description>Hello</description><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate></item></channel></rss>`,
            {
              status: 200,
            },
          ),
        ),
      ),
    );

    await handleObserveSourceJob(
      {
        collectorSettingId: "setting-1",
        collectorSettingSnapshotId: "setting-snapshot-1",
        config: {},
        jobId,
        pluginSlug: "podcast-rss",
        slug: source.slug,
        sourceId: source.id,
        sourceKind: "podcast",
        url: source.url,
      },
      {
        contentService,
        jobRepository,
        tmpRootDir,
      },
    );

    const contents = await contentRepository.listContents();
    const job = await jobRepository.findJobById(jobId);

    expect(contents).toHaveLength(1);
    expect(contents[0]).toMatchObject({
      sourceId: source.id,
      status: "discovered",
      title: "Episode 1",
    });
    expect(job?.status).toBe("succeeded");
  });

  it("marks the job as failed when feed fetch fails", async () => {
    const sourceRepository = new SourceRepository(testDatabase.database);
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
          collectorSettingId: "setting-2",
          collectorSettingSnapshotId: "setting-snapshot-2",
          config: {},
          jobId,
          pluginSlug: "podcast-rss",
          slug: source.slug,
          sourceId: source.id,
          sourceKind: "podcast",
          url: source.url,
        },
        {
          contentService: new ContentService(
            new ContentRepository(testDatabase.database),
          ),
          jobRepository,
          tmpRootDir,
        },
      ),
    ).rejects.toThrow("Failed to fetch RSS feed: 502");

    const job = await jobRepository.findJobById(jobId);

    expect(job?.status).toBe("failed");
    expect(job?.failureMessage).toContain("Failed to fetch RSS feed: 502");
  });
});
