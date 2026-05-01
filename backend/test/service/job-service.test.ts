import { v7 as uuidv7 } from "uuid";
import { describe, expect, it, vi } from "vitest";

import type {
  JobListItem,
  JobRepository,
} from "../../src/db/job-repository.js";
import type { JobQueue } from "../../src/job-queue/types.js";
import { OBSERVE_SOURCE_JOB_NAME } from "../../src/job-queue/types.js";
import { ok } from "../../src/lib/result.js";
import { createJobService } from "../../src/service/job-service.js";
import type { SourceService } from "../../src/service/source-service.js";
import { assertErr } from "../support/result.js";

vi.mock("uuid", () => ({
  v7: vi.fn(() => "job-uuid-1"),
}));

describe("job service", () => {
  it("enqueues observe jobs and returns the persisted job", async () => {
    const observeTarget = {
      collectorSettingId: "collector-1",
      collectorSettingSnapshotId: "snapshot-1",
      config: { category: "news" },
      crawlEnabled: true,
      crawlIntervalMinutes: 60,
      pluginSlug: "podcast-rss",
      slug: "example-feed",
      sourceId: "source-1",
      sourceKind: "podcast",
      url: "https://example.com/feed.xml",
    } as const;
    const createdJob = {
      attemptCount: 0,
      createdAt: new Date("2026-05-01T00:00:00.000Z"),
      failureMessage: null,
      finishedAt: null,
      id: "job-uuid-1",
      kind: "observe-source",
      queueJobId: null,
      retryable: true,
      sourceId: "source-1",
      startedAt: null,
      status: "queued",
    } satisfies JobListItem;
    const enqueue = vi.fn(() => Promise.resolve("queue-job-1"));
    const attachQueueJobId = vi.fn(() => Promise.resolve(ok(undefined)));
    const createJob = vi.fn(() => Promise.resolve(ok(createdJob)));
    const findJobById = vi.fn(() =>
      Promise.resolve({ ...createdJob, queueJobId: "queue-job-1" }),
    );
    const queue = {
      enqueue,
    } as unknown as JobQueue;
    const repository = {
      attachQueueJobId,
      createJob,
      findJobById,
    } as unknown as JobRepository;
    const sourceService = {
      findObserveSourceTarget: vi.fn(() => Promise.resolve(ok(observeTarget))),
    } as unknown as SourceService;
    const service = createJobService(sourceService, repository, queue);

    const result = await service.enqueueObserveSourceJob("source-1");

    expect(uuidv7).toHaveBeenCalledTimes(1);
    expect(createJob).toHaveBeenCalledWith({
      id: "job-uuid-1",
      kind: "observe-source",
      retryable: true,
      sourceId: "source-1",
    });
    expect(enqueue).toHaveBeenCalledWith(OBSERVE_SOURCE_JOB_NAME, {
      collector: {
        config: { category: "news" },
        pluginSlug: "podcast-rss",
        settingId: "collector-1",
        settingSnapshotId: "snapshot-1",
      },
      jobId: "job-uuid-1",
      source: {
        id: "source-1",
        kind: "podcast",
        slug: "example-feed",
        url: "https://example.com/feed.xml",
      },
    });
    expect(result).toEqual(
      ok({
        ...createdJob,
        queueJobId: "queue-job-1",
      }),
    );
  });

  it("returns an infrastructure error when the persisted job disappears", async () => {
    const enqueue = vi.fn(() => Promise.resolve("queue-job-1"));
    const queue = {
      enqueue,
    } as unknown as JobQueue;
    const repository = {
      attachQueueJobId: vi.fn(() => Promise.resolve(ok(undefined))),
      createJob: vi.fn(() =>
        Promise.resolve(
          ok({
            attemptCount: 0,
            createdAt: new Date("2026-05-01T00:00:00.000Z"),
            failureMessage: null,
            finishedAt: null,
            id: "job-uuid-1",
            kind: "observe-source",
            queueJobId: null,
            retryable: true,
            sourceId: "source-1",
            startedAt: null,
            status: "queued",
          } satisfies JobListItem),
        ),
      ),
      findJobById: vi.fn(() => Promise.resolve(null)),
    } as unknown as JobRepository;
    const sourceService = {
      findObserveSourceTarget: vi.fn(() =>
        Promise.resolve(
          ok({
            collectorSettingId: "collector-1",
            collectorSettingSnapshotId: "snapshot-1",
            config: {},
            crawlEnabled: true,
            crawlIntervalMinutes: 60,
            pluginSlug: "podcast-rss",
            slug: "example-feed",
            sourceId: "source-1",
            sourceKind: "podcast",
            url: "https://example.com/feed.xml",
          }),
        ),
      ),
    } as unknown as SourceService;
    const service = createJobService(sourceService, repository, queue);

    const result = await service.enqueueObserveSourceJob("source-1");

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected error");
    }
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error.message).toContain("Job disappeared after enqueue");
  });

  it("maps missing jobs to job_not_found", async () => {
    const service = createJobService(
      {
        findObserveSourceTarget: vi.fn(),
      } as unknown as SourceService,
      {
        findJobById: vi.fn(() => Promise.resolve(null)),
      } as unknown as JobRepository,
      {
        enqueue: vi.fn(),
      } as unknown as JobQueue,
    );

    const result = await service.findJobById("missing");

    assertErr(result);
    expect(result.error).toEqual({
      code: "job_not_found",
      message: "Job not found.",
    });
  });
});
