import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  OBSERVE_SOURCE_JOB_NAME,
  PERIODIC_CRAWL_JOB_NAME,
} from "../../src/job-queue/types.js";
import { ok } from "../../src/lib/result.js";
import { createNoopLogger } from "../../src/logger/index.js";
import { handlePeriodicCrawlJob } from "../../src/workers/periodic-crawl/handle.js";

vi.mock("uuid", () => ({
  v7: vi.fn(() => "next-periodic-job-1"),
}));

describe("periodic-crawl worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("recovers stale observe jobs before selecting crawl targets", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T00:00:00.000Z"));

    const recoverStaleObserveSourceJobs = vi.fn(() =>
      Promise.resolve(ok({ failedJobIds: ["stale-observe-job-1"] })),
    );
    const listIncompleteObserveSourceIds = vi.fn(() =>
      Promise.resolve(ok(new Set())),
    );
    const enqueueObserveSourceJob = vi.fn(() =>
      Promise.resolve(
        ok({
          attemptCount: 0,
          createdAt: new Date("2026-06-10T00:00:00.000Z"),
          failureMessage: null,
          finishedAt: null,
          id: "observe-job-2",
          kind: OBSERVE_SOURCE_JOB_NAME,
          metadata: {},
          payload: {},
          queueJobId: "queue-observe-2",
          retryable: true,
          startedAt: null,
          status: "queued" as const,
        }),
      ),
    );
    const createJob = vi.fn(() =>
      Promise.resolve(
        ok({
          id: "next-periodic-job-1",
        }),
      ),
    );
    const enqueueAfter = vi.fn(() => Promise.resolve("queue-periodic-2"));
    const attachQueueJobId = vi.fn(() => Promise.resolve(ok(undefined)));

    const result = await handlePeriodicCrawlJob(
      {
        jobId: "periodic-job-1",
      },
      {
        appSettingService: {
          getPeriodicCrawlSettings: vi.fn(() =>
            Promise.resolve(
              ok({
                enabled: true,
                intervalMinutes: 60,
              }),
            ),
          ),
        } as never,
        jobQueue: {
          enqueueAfter,
        } as never,
        jobRepository: {
          attachQueueJobId,
          createJob,
          findLatestObserveJobsBySourceIds: vi.fn(() =>
            Promise.resolve(ok(new Map())),
          ),
          listIncompleteObserveSourceIds,
          markFailed: vi.fn(() => Promise.resolve(ok(undefined))),
          markRunning: vi.fn(() => Promise.resolve(ok(undefined))),
          markSucceeded: vi.fn(() => Promise.resolve(ok(undefined))),
          recoverStaleObserveSourceJobs,
        } as never,
        jobService: {
          enqueueObserveSourceJob,
        } as never,
        logger: createNoopLogger(),
        sourceService: {
          listPeriodicCrawlTargets: vi.fn(() =>
            Promise.resolve(
              ok([
                {
                  collectorSettingId: "collector-setting-1",
                  collectorSettingSnapshotId: "collector-setting-snapshot-1",
                  config: {},
                  crawlEnabled: true,
                  crawlIntervalMinutes: 60,
                  pluginSlug: "rss",
                  slug: "satanica-1132f3a18898",
                  sourceId: "source-1",
                  sourceKind: "feed" as const,
                  url: "https://shonenjumpplus.com/rss/series/17107419589695933516",
                },
              ]),
            ),
          ),
        } as never,
      },
    );

    expect(result).toEqual(ok(undefined));
    expect(
      recoverStaleObserveSourceJobs.mock.invocationCallOrder[0],
    ).toBeLessThan(listIncompleteObserveSourceIds.mock.invocationCallOrder[0]);
    expect(recoverStaleObserveSourceJobs).toHaveBeenCalledWith({
      detectedBy: PERIODIC_CRAWL_JOB_NAME,
      now: new Date("2026-06-10T00:00:00.000Z"),
      targets: [
        {
          crawlIntervalMinutes: 60,
          sourceId: "source-1",
        },
      ],
    });
    expect(enqueueObserveSourceJob).toHaveBeenCalledWith("source-1");
    expect(createJob).toHaveBeenCalledWith({
      id: "next-periodic-job-1",
      kind: PERIODIC_CRAWL_JOB_NAME,
      payload: {
        jobId: "next-periodic-job-1",
      },
      retryable: true,
    });
    expect(enqueueAfter).toHaveBeenCalledWith(
      PERIODIC_CRAWL_JOB_NAME,
      {
        jobId: "next-periodic-job-1",
      },
      new Date("2026-06-10T01:00:00.000Z"),
    );
    expect(attachQueueJobId).toHaveBeenCalledWith(
      "next-periodic-job-1",
      "queue-periodic-2",
    );
  });
});
