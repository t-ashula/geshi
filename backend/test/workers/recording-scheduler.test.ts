import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  RECORD_CONTENT_JOB_NAME,
  RECORDING_SCHEDULER_JOB_NAME,
} from "../../src/job-queue/types.js";
import { ok } from "../../src/lib/result.js";
import { createNoopLogger } from "../../src/logger/index.js";
import { handleRecordingSchedulerJob } from "../../src/workers/recording-scheduler/handle.js";

vi.mock("uuid", () => ({
  v7: vi.fn(() => "next-scheduler-job-1"),
}));

describe("recording scheduler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enqueues due record-content jobs from repository metadata", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-05T00:00:10.000Z"));

    const enqueue = vi
      .fn()
      .mockResolvedValueOnce("queue-record-1")
      .mockResolvedValueOnce("queue-scheduler-2");
    const attachQueueJobId = vi.fn(() => Promise.resolve(ok(undefined)));
    const createJob = vi.fn(() =>
      Promise.resolve(
        ok({
          id: "next-scheduler-job-1",
        }),
      ),
    );
    const startRecordContentWorker = vi.fn(() => Promise.resolve());

    const result = await handleRecordingSchedulerJob(
      {
        jobId: "recording-scheduler-job-1",
      },
      {
        jobQueue: {
          enqueue,
          enqueueAfter: vi.fn(() => Promise.resolve("queue-scheduler-2")),
        },
        jobRepository: {
          attachQueueJobId,
          createJob,
          listQueuedJobsWithoutQueueIdByKind: vi.fn(() =>
            Promise.resolve(
              ok([
                {
                  createdAt: new Date("2026-05-05T00:00:00.000Z"),
                  id: "record-job-1",
                  kind: RECORD_CONTENT_JOB_NAME,
                  metadata: {
                    core: {
                      payload: {
                        asset: {
                          id: "asset-1",
                          kind: "audio",
                          observedFingerprint: "stream-observed:1",
                          primary: true,
                          sourceUrl: "http://localhost:3401/streams/live-1",
                        },
                        collector: {
                          config: {},
                          pluginSlug: "streaming-plugin-example",
                          settingId: "collector-setting-1",
                          settingSnapshotId: "collector-setting-snapshot-1",
                        },
                        content: {
                          externalId: "live-1",
                          id: "content-1",
                          kind: "stream-recording",
                          publishedAt: null,
                          status: "discovered",
                          summary: "fixture stream",
                          title: "Live 1",
                        },
                        jobId: "record-job-1",
                        source: {
                          id: "source-1",
                          slug: "stream-1",
                        },
                      },
                      scheduledStartAt: "2026-05-05T00:00:00.000Z",
                    },
                  },
                },
              ]),
            ),
          ),
          markRunning: vi.fn(() => Promise.resolve(ok(undefined))),
          markSucceeded: vi.fn(() => Promise.resolve(ok(undefined))),
        } as never,
        logger: createNoopLogger(),
        startRecordContentWorker,
      },
    );

    expect(result).toEqual(ok(undefined));
    expect(enqueue).toHaveBeenCalledWith(RECORD_CONTENT_JOB_NAME, {
      asset: {
        id: "asset-1",
        kind: "audio",
        observedFingerprint: "stream-observed:1",
        primary: true,
        sourceUrl: "http://localhost:3401/streams/live-1",
      },
      collector: {
        config: {},
        pluginSlug: "streaming-plugin-example",
        settingId: "collector-setting-1",
        settingSnapshotId: "collector-setting-snapshot-1",
      },
      content: {
        externalId: "live-1",
        id: "content-1",
        kind: "stream-recording",
        publishedAt: null,
        status: "discovered",
        summary: "fixture stream",
        title: "Live 1",
      },
      jobId: "record-job-1",
      source: {
        id: "source-1",
        slug: "stream-1",
      },
    });
    expect(createJob).toHaveBeenCalledWith({
      id: "next-scheduler-job-1",
      kind: RECORDING_SCHEDULER_JOB_NAME,
      retryable: true,
      sourceId: null,
    });
    expect(attachQueueJobId).toHaveBeenCalledTimes(2);
    expect(startRecordContentWorker).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
