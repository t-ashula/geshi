import type { RecordedAsset, SourceCollectorRecordInput } from "@geshi/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ok } from "../../src/lib/result.js";
import { createNoopLogger } from "../../src/logger/index.js";
import { handleObserveSourceJob } from "../../src/workers/observe-source/handle.js";
import { handleRecordContentJob } from "../../src/workers/record-content/handle.js";

vi.mock("uuid", () => ({
  v7: vi.fn(() => "record-job-1"),
}));

describe("observe to record arguments handoff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes next-action arguments through job metadata into plugin.record()", async () => {
    let createdRecordJob:
      | {
          id: string;
          metadata: unknown;
        }
      | undefined;
    let recordedArguments: SourceCollectorRecordInput["arguments"] | undefined;
    type CreatedJobInput = {
      id: string;
      metadata: unknown;
    };

    const observePlugin = {
      observe: vi.fn(() =>
        Promise.resolve({
          contents: [
            {
              assets: [
                {
                  kind: "audio",
                  nextAction: {
                    actionKind: "record" as const,
                    arguments: {
                      durationSeconds: 15,
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
      ),
      record: vi.fn(
        (input: SourceCollectorRecordInput): Promise<RecordedAsset> => {
          recordedArguments = input.arguments;

          return Promise.resolve({
            acquiredFingerprints: ["recorded:1"],
            body: new Uint8Array([1, 2, 3]),
            contentType: "audio/mpeg",
            kind: input.asset.kind,
            metadata: {},
            primary: input.asset.primary,
            sourceUrl:
              typeof input.arguments.playlistUrl === "string"
                ? input.arguments.playlistUrl
                : null,
          });
        },
      ),
    };

    const createJob = vi.fn((input: CreatedJobInput) => {
      createdRecordJob = {
        id: input.id,
        metadata: input.metadata,
      };

      return Promise.resolve(ok({ id: input.id }));
    });

    const observeResult = await handleObserveSourceJob(
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
          markRunning: vi.fn(() => Promise.resolve(ok(undefined))),
          markSucceeded: vi.fn(() => Promise.resolve(ok(undefined))),
        } as never,
        logger: createNoopLogger(),
        sourceCollectorRegistry: {
          get: vi.fn(() => observePlugin),
        } as never,
      },
    );

    expect(observeResult).toEqual(ok(undefined));
    expect(createdRecordJob).toBeDefined();

    const recordMetadata = createdRecordJob?.metadata as {
      plugin?: {
        arguments?: SourceCollectorRecordInput["arguments"];
      };
    };
    const recordPayload = (
      createdRecordJob?.metadata as {
        core?: {
          payload?: Parameters<typeof handleRecordContentJob>[0];
        };
      }
    ).core?.payload;

    expect(recordMetadata.plugin?.arguments).toEqual({
      durationSeconds: 15,
      playlistUrl: "http://localhost:3401/streams/live-1.m3u8",
    });

    const recordResult = await handleRecordContentJob(recordPayload!, {
      assetService: {
        upsertStoredAsset: vi.fn(() => Promise.resolve(ok(undefined))),
      } as never,
      collectorPluginStateRepository: {
        findLatestStateByCollectorSettingId: vi.fn(() =>
          Promise.resolve(ok(undefined)),
        ),
      } as never,
      contentService: {
        markContentStatus: vi.fn(() => Promise.resolve(ok(undefined))),
      } as never,
      jobRepository: {
        getMetadata: vi.fn(() =>
          Promise.resolve(
            ok({
              core: {
                actionKind: "record",
              },
              plugin: {
                arguments: recordMetadata.plugin?.arguments ?? {},
              },
            }),
          ),
        ),
        markFailed: vi.fn(() => Promise.resolve(ok(undefined))),
        markRunning: vi.fn(() => Promise.resolve(ok(undefined))),
        markSucceeded: vi.fn(() => Promise.resolve(ok(undefined))),
        replaceMetadata: vi.fn(() => Promise.resolve(ok(undefined))),
      } as never,
      logger: createNoopLogger(),
      sourceCollectorRegistry: {
        get: vi.fn(() => observePlugin),
      } as never,
      storage: {
        pathJoin: (...parts: string[]) => parts.join("/"),
        put: vi.fn(() =>
          Promise.resolve(
            ok({
              byteSize: 3,
              key: "stream-1/content-1/audio/asset-1/title/recorded-1.mp3",
            }),
          ),
        ),
      } as never,
    });

    expect(recordResult).toEqual(ok(undefined));
    expect(recordedArguments).toEqual({
      durationSeconds: 15,
      playlistUrl: "http://localhost:3401/streams/live-1.m3u8",
    });
  });
});
