import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERIODIC_SOURCE_DETECTION_JOB_NAME } from "../../src/job-queue/types.js";
import { ok } from "../../src/lib/result.js";
import { createNoopLogger } from "../../src/logger/index.js";
import { handlePeriodicSourceDetectionJob } from "../../src/workers/periodic-source-detection/handle.js";

vi.mock("uuid", () => ({
  v7: vi.fn(() => "next-detect-job-1"),
}));

describe("periodic source detection worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("processes due targets and schedules the next run", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T00:00:00.000Z"));

    const detectSourceTarget = vi.fn(() =>
      Promise.resolve(
        ok({
          detectedCount: 1,
          duplicateCount: 0,
          processedCount: 1,
        }),
      ),
    );
    const attachQueueJobId = vi.fn(() => Promise.resolve(ok(undefined)));
    const createJob = vi.fn(() =>
      Promise.resolve(
        ok({
          id: "next-detect-job-1",
        }),
      ),
    );
    const enqueueAfter = vi.fn(() => Promise.resolve("queue-detect-2"));

    const result = await handlePeriodicSourceDetectionJob(
      {
        jobId: "detect-job-1",
      },
      {
        jobQueue: {
          enqueueAfter,
        } as never,
        jobRepository: {
          attachQueueJobId,
          createJob,
          markFailed: vi.fn(() => Promise.resolve(ok(undefined))),
          markRunning: vi.fn(() => Promise.resolve(ok(undefined))),
          markSucceeded: vi.fn(() => Promise.resolve(ok(undefined))),
        } as never,
        logger: createNoopLogger(),
        sourceDetectionService: {
          createSourceDetectionTarget: vi.fn(),
          detectSourceTarget,
          dismissDetectedSourceCandidate: vi.fn(),
          listDetectedSourceCandidates: vi.fn(),
          listTargets: vi.fn(),
          listEnabledTargets: vi.fn(() =>
            Promise.resolve(
              ok([
                {
                  config: {},
                  enabled: true,
                  id: "target-due",
                  intervalMinutes: 30,
                  lastCheckedAt: null,
                  pluginSlug: "radio-onsen",
                  sourceKind: "podcast" as const,
                  state: undefined,
                  url: "https://www.onsen.ag",
                  userId: "user-1",
                },
                {
                  config: {},
                  enabled: true,
                  id: "target-skip",
                  intervalMinutes: 60,
                  lastCheckedAt: new Date("2026-06-09T23:30:00.000Z"),
                  pluginSlug: "radio-onsen",
                  sourceKind: "podcast" as const,
                  state: undefined,
                  url: "https://www.onsen.ag",
                  userId: "user-1",
                },
              ]),
            ),
          ),
          registerDetectedSourceCandidate: vi.fn(),
          updateSourceDetectionTarget: vi.fn(),
        },
      },
    );

    expect(result).toEqual(ok(undefined));
    expect(detectSourceTarget).toHaveBeenCalledTimes(1);
    expect(detectSourceTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "target-due",
      }),
    );
    expect(createJob).toHaveBeenCalledWith({
      id: "next-detect-job-1",
      kind: PERIODIC_SOURCE_DETECTION_JOB_NAME,
      payload: {
        jobId: "next-detect-job-1",
      },
      retryable: true,
    });
    expect(enqueueAfter).toHaveBeenCalledWith(
      PERIODIC_SOURCE_DETECTION_JOB_NAME,
      {
        jobId: "next-detect-job-1",
      },
      new Date("2026-06-10T00:30:00.000Z"),
    );
    expect(attachQueueJobId).toHaveBeenCalledWith(
      "next-detect-job-1",
      "queue-detect-2",
    );

    vi.useRealTimers();
  });
});
