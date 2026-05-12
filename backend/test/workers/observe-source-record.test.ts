import { beforeEach, describe, expect, it, vi } from "vitest";

import { RECORD_CONTENT_JOB_NAME } from "../../src/job-queue/types.js";
import { ok } from "../../src/lib/result.js";
import { createNoopLogger } from "../../src/logger/index.js";
import { handleObserveSourceJob } from "../../src/workers/observe-source/handle.js";

vi.mock("uuid", () => ({
  v7: vi.fn(() => "record-job-1"),
}));

describe("observe-source record branching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a record-content job with plugin arguments and does not enqueue immediately", async () => {
    const observe = vi.fn(() =>
      Promise.resolve({
        contents: [
          {
            assets: [
              {
                kind: "audio",
                nextAction: {
                  actionKind: "record" as const,
                  arguments: {
                    playlistUrl: "http://localhost:3401/streams/live-1.m3u8",
                  },
                  expirationPolicy: {
                    action: "mark_non_actionable" as const,
                    reason: "missed-recording-window" as const,
                  },
                  latestRunnableAt: new Date("2026-05-05T01:00:00.000Z"),
                  scheduledStartAt: new Date("2026-05-05T00:00:00.000Z"),
                },
                observedFingerprints: ["stream-observed:1"],
                primary: true,
                sourceUrl: "http://localhost:3401/streams/live-1.m3u8",
              },
            ],
            contentFingerprints: ["content:1"],
            externalId: "live-1",
            kind: "stream-recording",
            publishedAt: null,
            status: "discovered" as const,
            summary: "fixture stream",
            title: "Live 1",
          },
        ],
      }),
    );
    const createJob = vi.fn(() =>
      Promise.resolve(
        ok({
          id: "record-job-1",
        }),
      ),
    );
    const enqueue = vi.fn();

    const result = await handleObserveSourceJob(
      {
        collector: {
          config: {},
          pluginSlug: "streaming-plugin-example",
          settingId: "collector-setting-1",
          settingSnapshotId: "collector-setting-snapshot-1",
        },
        jobId: "observe-job-1",
        source: {
          id: "source-1",
          kind: "streaming",
          slug: "stream-1",
          url: "http://localhost:3401/sources/streams/live-1",
        },
      },
      {
        assetService: {
          createObservedAssets: vi.fn(() =>
            Promise.resolve(
              ok({
                assetIdsRequiringAcquire: ["asset-1"],
              }),
            ),
          ),
          findAcquireTargetById: vi.fn(() =>
            Promise.resolve(
              ok({
                id: "asset-1",
                observedFingerprint: "stream-observed:1",
              }),
            ),
          ),
        } as never,
        collectorPluginStateRepository: {
          findLatestStateByCollectorSettingId: vi.fn(() =>
            Promise.resolve(ok(undefined)),
          ),
          saveState: vi.fn(() => Promise.resolve(ok(undefined))),
        } as never,
        contentService: {
          createObservedContent: vi.fn(() =>
            Promise.resolve(
              ok({
                fingerprintChanged: true,
                id: "content-1",
              }),
            ),
          ),
        } as never,
        jobQueue: {
          enqueue,
        } as never,
        jobRepository: {
          createJob,
          listIncompleteRecordContentAssetIds: vi.fn(() =>
            Promise.resolve(ok(new Set())),
          ),
          markRunning: vi.fn(() => Promise.resolve(ok(undefined))),
          markSucceeded: vi.fn(() => Promise.resolve(ok(undefined))),
        } as never,
        logger: createNoopLogger(),
        sourceCollectorRegistry: {
          get: vi.fn(() => ({
            observe,
          })),
        } as never,
      },
    );

    expect(result).toEqual(ok(undefined));
    expect(observe).toHaveBeenCalledTimes(1);
    expect(createJob).toHaveBeenCalledWith({
      id: "record-job-1",
      kind: RECORD_CONTENT_JOB_NAME,
      metadata: {
        core: {
          actionKind: "record",
          expirationPolicy: {
            action: "mark_non_actionable",
            message: null,
            reason: "missed-recording-window",
          },
          latestRunnableAt: "2026-05-05T01:00:00.000Z",
          scheduledStartAt: "2026-05-05T00:00:00.000Z",
        },
        plugin: {
          arguments: {
            playlistUrl: "http://localhost:3401/streams/live-1.m3u8",
          },
        },
      },
      payload: {
        asset: {
          id: "asset-1",
          kind: "audio",
          observedFingerprint: "stream-observed:1",
          primary: true,
          sourceUrl: "http://localhost:3401/streams/live-1.m3u8",
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
      retryable: true,
    });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("does not create a job for non-actionable assets", async () => {
    const observe = vi.fn(() =>
      Promise.resolve({
        contents: [
          {
            assets: [
              {
                kind: "audio",
                nextAction: {
                  actionKind: "none" as const,
                  reason: "missed-recording-window" as const,
                },
                observedFingerprints: ["stream-observed:1"],
                primary: true,
                sourceUrl: "http://localhost:3401/streams/live-1.m3u8",
              },
            ],
            contentFingerprints: ["content:1"],
            externalId: "live-1",
            kind: "stream-recording",
            publishedAt: null,
            status: "discovered" as const,
            summary: "fixture stream",
            title: "Live 1",
          },
        ],
      }),
    );
    const createJob = vi.fn();

    const result = await handleObserveSourceJob(
      {
        collector: {
          config: {},
          pluginSlug: "streaming-plugin-example",
          settingId: "collector-setting-1",
          settingSnapshotId: "collector-setting-snapshot-1",
        },
        jobId: "observe-job-1",
        source: {
          id: "source-1",
          kind: "streaming",
          slug: "stream-1",
          url: "http://localhost:3401/sources/streams/live-1",
        },
      },
      {
        assetService: {
          createObservedAssets: vi.fn(() =>
            Promise.resolve(
              ok({
                assetIdsRequiringAcquire: ["asset-1"],
              }),
            ),
          ),
          findAcquireTargetById: vi.fn(() =>
            Promise.resolve(
              ok({
                id: "asset-1",
                observedFingerprint: "stream-observed:1",
              }),
            ),
          ),
        } as never,
        collectorPluginStateRepository: {
          findLatestStateByCollectorSettingId: vi.fn(() =>
            Promise.resolve(ok(undefined)),
          ),
          saveState: vi.fn(() => Promise.resolve(ok(undefined))),
        } as never,
        contentService: {
          createObservedContent: vi.fn(() =>
            Promise.resolve(
              ok({
                fingerprintChanged: true,
                id: "content-1",
              }),
            ),
          ),
        } as never,
        jobQueue: {
          enqueue: vi.fn(),
        } as never,
        jobRepository: {
          createJob,
          listIncompleteRecordContentAssetIds: vi.fn(() =>
            Promise.resolve(ok(new Set())),
          ),
          markRunning: vi.fn(() => Promise.resolve(ok(undefined))),
          markSucceeded: vi.fn(() => Promise.resolve(ok(undefined))),
        } as never,
        logger: createNoopLogger(),
        sourceCollectorRegistry: {
          get: vi.fn(() => ({
            observe,
          })),
        } as never,
      },
    );

    expect(result).toEqual(ok(undefined));
    expect(createJob).not.toHaveBeenCalled();
  });

  it("does not create a duplicate record-content job for an asset that already has one queued or running", async () => {
    const observe = vi.fn(() =>
      Promise.resolve({
        contents: [
          {
            assets: [
              {
                kind: "audio",
                nextAction: {
                  actionKind: "record" as const,
                  arguments: {
                    playlistUrl: "http://localhost:3401/streams/live-1.m3u8",
                  },
                  scheduledStartAt: new Date("2026-05-05T00:00:00.000Z"),
                },
                observedFingerprints: ["stream-observed:1"],
                primary: true,
                sourceUrl: "http://localhost:3401/streams/live-1.m3u8",
              },
            ],
            contentFingerprints: ["content:1"],
            externalId: "live-1",
            kind: "stream-recording",
            publishedAt: null,
            status: "discovered" as const,
            summary: "fixture stream",
            title: "Live 1",
          },
        ],
      }),
    );
    const createJob = vi.fn();

    const result = await handleObserveSourceJob(
      {
        collector: {
          config: {},
          pluginSlug: "streaming-plugin-example",
          settingId: "collector-setting-1",
          settingSnapshotId: "collector-setting-snapshot-1",
        },
        jobId: "observe-job-1",
        source: {
          id: "source-1",
          kind: "streaming",
          slug: "stream-1",
          url: "http://localhost:3401/sources/streams/live-1",
        },
      },
      {
        assetService: {
          createObservedAssets: vi.fn(() =>
            Promise.resolve(
              ok({
                assetIdsRequiringAcquire: ["asset-1"],
              }),
            ),
          ),
          findAcquireTargetById: vi.fn(() =>
            Promise.resolve(
              ok({
                id: "asset-1",
                observedFingerprint: "stream-observed:1",
              }),
            ),
          ),
        } as never,
        collectorPluginStateRepository: {
          findLatestStateByCollectorSettingId: vi.fn(() =>
            Promise.resolve(ok(undefined)),
          ),
          saveState: vi.fn(() => Promise.resolve(ok(undefined))),
        } as never,
        contentService: {
          createObservedContent: vi.fn(() =>
            Promise.resolve(
              ok({
                fingerprintChanged: true,
                id: "content-1",
              }),
            ),
          ),
        } as never,
        jobQueue: {
          enqueue: vi.fn(),
        } as never,
        jobRepository: {
          createJob,
          listIncompleteRecordContentAssetIds: vi.fn(() =>
            Promise.resolve(ok(new Set(["asset-1"]))),
          ),
          markRunning: vi.fn(() => Promise.resolve(ok(undefined))),
          markSucceeded: vi.fn(() => Promise.resolve(ok(undefined))),
        } as never,
        logger: createNoopLogger(),
        sourceCollectorRegistry: {
          get: vi.fn(() => ({
            observe,
          })),
        } as never,
      },
    );

    expect(result).toEqual(ok(undefined));
    expect(createJob).not.toHaveBeenCalled();
  });

  it("matches persisted observed fingerprints using the latest fingerprint version", async () => {
    const observe = vi.fn(() =>
      Promise.resolve({
        contents: [
          {
            assets: [
              {
                kind: "audio",
                nextAction: {
                  actionKind: "record" as const,
                  arguments: {
                    playlistUrl: "http://localhost:3401/streams/live-1.m3u8",
                  },
                },
                observedFingerprints: [
                  "2026-05-10:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                  "stream-observed:legacy-1",
                ],
                primary: true,
                sourceUrl: "http://localhost:3401/streams/live-1.m3u8",
              },
            ],
            contentFingerprints: ["content:1"],
            externalId: "live-1",
            kind: "stream-recording",
            publishedAt: null,
            status: "discovered" as const,
            summary: "fixture stream",
            title: "Live 1",
          },
        ],
      }),
    );
    const createJob = vi.fn(() =>
      Promise.resolve(
        ok({
          id: "record-job-1",
        }),
      ),
    );

    const result = await handleObserveSourceJob(
      {
        collector: {
          config: {},
          pluginSlug: "streaming-plugin-example",
          settingId: "collector-setting-1",
          settingSnapshotId: "collector-setting-snapshot-1",
        },
        jobId: "observe-job-1",
        source: {
          id: "source-1",
          kind: "streaming",
          slug: "stream-1",
          url: "http://localhost:3401/sources/streams/live-1",
        },
      },
      {
        assetService: {
          createObservedAssets: vi.fn(() =>
            Promise.resolve(
              ok({
                assetIdsRequiringAcquire: ["asset-1"],
              }),
            ),
          ),
          findAcquireTargetById: vi.fn(() =>
            Promise.resolve(
              ok({
                id: "asset-1",
                observedFingerprint:
                  "2026-05-10:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              }),
            ),
          ),
        } as never,
        collectorPluginStateRepository: {
          findLatestStateByCollectorSettingId: vi.fn(() =>
            Promise.resolve(ok(undefined)),
          ),
          saveState: vi.fn(() => Promise.resolve(ok(undefined))),
        } as never,
        contentService: {
          createObservedContent: vi.fn(() =>
            Promise.resolve(
              ok({
                fingerprintChanged: true,
                id: "content-1",
              }),
            ),
          ),
        } as never,
        jobQueue: {
          enqueue: vi.fn(),
        } as never,
        jobRepository: {
          createJob,
          listIncompleteRecordContentAssetIds: vi.fn(() =>
            Promise.resolve(ok(new Set())),
          ),
          markRunning: vi.fn(() => Promise.resolve(ok(undefined))),
          markSucceeded: vi.fn(() => Promise.resolve(ok(undefined))),
        } as never,
        logger: createNoopLogger(),
        sourceCollectorRegistry: {
          get: vi.fn(() => ({
            observe,
          })),
        } as never,
      },
    );

    expect(result).toEqual(ok(undefined));
    expect(createJob).toHaveBeenCalledTimes(1);
    const createJobCall = createJob.mock.calls[0] as unknown as [
      {
        payload: {
          asset: {
            observedFingerprint: string;
          };
        };
      },
    ];
    const createJobInput = createJobCall[0];

    expect(createJobInput).toMatchObject({
      payload: {
        asset: {
          observedFingerprint:
            "2026-05-10:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
      },
    });
  });
});
