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
          scheduledStartAt: "2026-05-05T00:00:00.000Z",
        },
        plugin: {
          arguments: {
            playlistUrl: "http://localhost:3401/streams/live-1.m3u8",
          },
        },
      },
      retryable: true,
      sourceId: "source-1",
    });
    expect(enqueue).not.toHaveBeenCalled();
  });
});
