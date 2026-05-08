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

  function createQueuedRecordJob(
    id: string,
    scheduledStartAt: string | null,
    latestRunnableAt: string | null = null,
    expirationPolicy: {
      action: "mark_failed" | "mark_non_actionable";
      message: string | null;
      reason: "already-ended" | "missed-recording-window";
    } | null = null,
  ): {
    createdAt: Date;
    id: string;
    kind: string;
    metadata: {
      core: {
        expirationPolicy: {
          action: "mark_failed" | "mark_non_actionable";
          message: string | null;
          reason: "already-ended" | "missed-recording-window";
        } | null;
        latestRunnableAt: string | null;
        payload: {
          asset: {
            id: string;
            kind: string;
            observedFingerprint: string;
            primary: boolean;
            sourceUrl: string;
          };
          collector: {
            config: Record<string, never>;
            pluginSlug: string;
            settingId: string;
            settingSnapshotId: string;
          };
          content: {
            externalId: string;
            id: string;
            kind: string;
            publishedAt: null;
            status: string;
            summary: string;
            title: string;
          };
          jobId: string;
          source: {
            id: string;
            slug: string;
          };
        };
        scheduledStartAt: string | null;
      };
    };
  } {
    return {
      createdAt: new Date("2026-05-05T00:00:00.000Z"),
      id,
      kind: RECORD_CONTENT_JOB_NAME,
      metadata: {
        core: {
          expirationPolicy,
          latestRunnableAt,
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
            jobId: id,
            source: {
              id: "source-1",
              slug: "stream-1",
            },
          },
          scheduledStartAt,
        },
      },
    };
  }

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
                createQueuedRecordJob(
                  "record-job-1",
                  "2026-05-05T00:00:00.000Z",
                  null,
                  null,
                ),
              ]),
            ),
          ),
          listRunningRecordContentAssetIds: vi.fn(() =>
            Promise.resolve(ok(new Set())),
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

  it("enqueues jobs scheduled before the next scheduler tick", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-05T00:00:10.000Z"));

    const enqueue = vi
      .fn()
      .mockResolvedValueOnce("queue-record-1")
      .mockResolvedValueOnce("queue-scheduler-2");
    const attachQueueJobId = vi.fn(() => Promise.resolve(ok(undefined)));

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
          createJob: vi.fn(() =>
            Promise.resolve(
              ok({
                id: "next-scheduler-job-1",
              }),
            ),
          ),
          listQueuedJobsWithoutQueueIdByKind: vi.fn(() =>
            Promise.resolve(
              ok([
                createQueuedRecordJob(
                  "record-job-1",
                  "2026-05-05T00:00:25.000Z",
                  null,
                  null,
                ),
              ]),
            ),
          ),
          listRunningRecordContentAssetIds: vi.fn(() =>
            Promise.resolve(ok(new Set())),
          ),
          markRunning: vi.fn(() => Promise.resolve(ok(undefined))),
          markSucceeded: vi.fn(() => Promise.resolve(ok(undefined))),
        } as never,
        logger: createNoopLogger(),
        startRecordContentWorker: vi.fn(() => Promise.resolve()),
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
    expect(attachQueueJobId).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it("does not enqueue jobs scheduled after the next scheduler tick", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-05T00:00:10.000Z"));

    const enqueue = vi.fn().mockResolvedValue("queue-scheduler-2");
    const attachQueueJobId = vi.fn(() => Promise.resolve(ok(undefined)));
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
          createJob: vi.fn(() =>
            Promise.resolve(
              ok({
                id: "next-scheduler-job-1",
              }),
            ),
          ),
          listQueuedJobsWithoutQueueIdByKind: vi.fn(() =>
            Promise.resolve(
              ok([
                createQueuedRecordJob(
                  "record-job-1",
                  "2026-05-05T00:00:45.000Z",
                  null,
                  null,
                ),
              ]),
            ),
          ),
          listRunningRecordContentAssetIds: vi.fn(() =>
            Promise.resolve(ok(new Set())),
          ),
          markRunning: vi.fn(() => Promise.resolve(ok(undefined))),
          markSucceeded: vi.fn(() => Promise.resolve(ok(undefined))),
        } as never,
        logger: createNoopLogger(),
        startRecordContentWorker,
      },
    );

    expect(result).toEqual(ok(undefined));
    expect(enqueue).not.toHaveBeenCalledWith(
      RECORD_CONTENT_JOB_NAME,
      expect.anything(),
    );
    expect(startRecordContentWorker).not.toHaveBeenCalled();
    expect(attachQueueJobId).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("cleans up expired record jobs based on expiration policy", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-05T01:00:10.000Z"));

    const attachQueueJobId = vi.fn(() => Promise.resolve(ok(undefined)));
    const markFailed = vi.fn(() => Promise.resolve(ok(undefined)));
    const replaceMetadata = vi.fn(() => Promise.resolve(ok(undefined)));
    const startRecordContentWorker = vi.fn(() => Promise.resolve());

    const result = await handleRecordingSchedulerJob(
      {
        jobId: "recording-scheduler-job-1",
      },
      {
        jobQueue: {
          enqueue: vi.fn().mockResolvedValue("queue-scheduler-2"),
          enqueueAfter: vi.fn(() => Promise.resolve("queue-scheduler-2")),
        },
        jobRepository: {
          attachQueueJobId,
          createJob: vi.fn(() =>
            Promise.resolve(
              ok({
                id: "next-scheduler-job-1",
              }),
            ),
          ),
          listQueuedJobsWithoutQueueIdByKind: vi.fn(() =>
            Promise.resolve(
              ok([
                createQueuedRecordJob(
                  "record-job-1",
                  "2026-05-05T00:00:00.000Z",
                  "2026-05-05T00:30:00.000Z",
                  {
                    action: "mark_non_actionable",
                    message: "radiko recording window already closed.",
                    reason: "missed-recording-window",
                  },
                ),
              ]),
            ),
          ),
          listRunningRecordContentAssetIds: vi.fn(() =>
            Promise.resolve(ok(new Set())),
          ),
          markFailed,
          markRunning: vi.fn(() => Promise.resolve(ok(undefined))),
          markSucceeded: vi.fn(() => Promise.resolve(ok(undefined))),
          replaceMetadata,
        } as never,
        logger: createNoopLogger(),
        startRecordContentWorker,
      },
    );

    expect(result).toEqual(ok(undefined));
    const firstReplaceMetadataCall = replaceMetadata.mock.calls[0] as
      | unknown[]
      | undefined;
    const replaceMetadataJobId = firstReplaceMetadataCall?.[0];
    const replaceMetadataInput = firstReplaceMetadataCall?.[1] as
      | {
          core?: {
            cleanup?: {
              action?: string;
              cleanedUpAt?: string;
              message?: string | null;
              reason?: string;
            };
          };
        }
      | undefined;

    expect(replaceMetadataJobId).toBe("record-job-1");
    expect(replaceMetadataInput?.core?.cleanup).toMatchObject({
      action: "mark_non_actionable",
      message: "radiko recording window already closed.",
      reason: "missed-recording-window",
    });
    expect(typeof replaceMetadataInput?.core?.cleanup?.cleanedUpAt).toBe(
      "string",
    );
    expect(markFailed).toHaveBeenCalledWith(
      "record-job-1",
      "radiko recording window already closed.",
      false,
    );
    expect(startRecordContentWorker).not.toHaveBeenCalled();
    expect(attachQueueJobId).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("cleans up duplicate queued record jobs for the same asset and keeps only the newest one", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-05T00:00:10.000Z"));

    const enqueue = vi
      .fn()
      .mockResolvedValueOnce("queue-record-2")
      .mockResolvedValueOnce("queue-scheduler-2");
    const attachQueueJobId = vi.fn(() => Promise.resolve(ok(undefined)));
    const markFailed = vi.fn(() => Promise.resolve(ok(undefined)));
    const replaceMetadata = vi.fn(() => Promise.resolve(ok(undefined)));
    const startRecordContentWorker = vi.fn(() => Promise.resolve());

    const olderJob = createQueuedRecordJob(
      "record-job-1",
      "2026-05-05T00:00:00.000Z",
      null,
      null,
    );
    const newerJob = {
      ...createQueuedRecordJob(
        "record-job-2",
        "2026-05-05T00:00:00.000Z",
        null,
        null,
      ),
      createdAt: new Date("2026-05-05T00:00:01.000Z"),
      metadata: {
        core: {
          expirationPolicy: null,
          latestRunnableAt: null,
          payload: {
            ...createQueuedRecordJob(
              "record-job-2",
              "2026-05-05T00:00:00.000Z",
              null,
              null,
            ).metadata.core.payload,
            jobId: "record-job-2",
          },
          scheduledStartAt: "2026-05-05T00:00:00.000Z",
        },
      },
    };

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
          createJob: vi.fn(() =>
            Promise.resolve(
              ok({
                id: "next-scheduler-job-1",
              }),
            ),
          ),
          listQueuedJobsWithoutQueueIdByKind: vi.fn(() =>
            Promise.resolve(ok([olderJob, newerJob])),
          ),
          listRunningRecordContentAssetIds: vi.fn(() =>
            Promise.resolve(ok(new Set())),
          ),
          markFailed,
          markRunning: vi.fn(() => Promise.resolve(ok(undefined))),
          markSucceeded: vi.fn(() => Promise.resolve(ok(undefined))),
          replaceMetadata,
        } as never,
        logger: createNoopLogger(),
        startRecordContentWorker,
      },
    );

    expect(result).toEqual(ok(undefined));
    expect(markFailed).toHaveBeenCalledWith(
      "record-job-1",
      "Record job superseded by queued job record-job-2 for asset asset-1.",
      false,
    );
    expect(enqueue).toHaveBeenCalledWith(
      RECORD_CONTENT_JOB_NAME,
      expect.objectContaining({
        jobId: "record-job-2",
      }),
    );
    expect(startRecordContentWorker).toHaveBeenCalledTimes(1);

    const replaceMetadataCalls = replaceMetadata.mock.calls as unknown as Array<
      [string, Record<string, unknown>]
    >;
    const cleanupMetadataInput = replaceMetadataCalls[0]?.[1] as
      | {
          core?: {
            cleanup?: {
              action?: string;
              message?: string | null;
              reason?: string;
            };
          };
        }
      | undefined;
    expect(cleanupMetadataInput?.core?.cleanup).toMatchObject({
      action: "mark_failed",
      message:
        "Record job superseded by queued job record-job-2 for asset asset-1.",
      reason: "superseded-by-newer-record-job",
    });

    vi.useRealTimers();
  });

  it("cleans up queued jobs when the same asset already has a running record job", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-05T00:00:10.000Z"));

    const enqueue = vi.fn().mockResolvedValueOnce("queue-scheduler-2");
    const attachQueueJobId = vi.fn(() => Promise.resolve(ok(undefined)));
    const markFailed = vi.fn(() => Promise.resolve(ok(undefined)));
    const replaceMetadata = vi.fn(() => Promise.resolve(ok(undefined)));
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
          createJob: vi.fn(() =>
            Promise.resolve(
              ok({
                id: "next-scheduler-job-1",
              }),
            ),
          ),
          listQueuedJobsWithoutQueueIdByKind: vi.fn(() =>
            Promise.resolve(
              ok([
                createQueuedRecordJob(
                  "record-job-1",
                  "2026-05-05T00:00:00.000Z",
                  null,
                  null,
                ),
              ]),
            ),
          ),
          listRunningRecordContentAssetIds: vi.fn(() =>
            Promise.resolve(ok(new Set(["asset-1"]))),
          ),
          markFailed,
          markRunning: vi.fn(() => Promise.resolve(ok(undefined))),
          markSucceeded: vi.fn(() => Promise.resolve(ok(undefined))),
          replaceMetadata,
        } as never,
        logger: createNoopLogger(),
        startRecordContentWorker,
      },
    );

    expect(result).toEqual(ok(undefined));
    expect(markFailed).toHaveBeenCalledWith(
      "record-job-1",
      "Record job skipped because another record job is already running for asset asset-1.",
      false,
    );
    expect(enqueue).not.toHaveBeenCalledWith(
      RECORD_CONTENT_JOB_NAME,
      expect.anything(),
    );
    expect(startRecordContentWorker).not.toHaveBeenCalled();

    const replaceMetadataCalls = replaceMetadata.mock.calls as unknown as Array<
      [string, Record<string, unknown>]
    >;
    const cleanupMetadataInput = replaceMetadataCalls[0]?.[1] as
      | {
          core?: {
            cleanup?: {
              action?: string;
              message?: string | null;
              reason?: string;
            };
          };
        }
      | undefined;
    expect(cleanupMetadataInput?.core?.cleanup).toMatchObject({
      action: "mark_failed",
      message:
        "Record job skipped because another record job is already running for asset asset-1.",
      reason: "running-record-job-already-exists",
    });

    vi.useRealTimers();
  });
});
