import type { RecordedAsset, SourceCollectorRecordInput } from "@geshi/sdk";
import { describe, expect, it, vi } from "vitest";

import { ok } from "../../src/lib/result.js";
import { createNoopLogger } from "../../src/logger/index.js";
import { handleRecordContentJob } from "../../src/workers/record-content/handle.js";

describe("record-content metadata updates", () => {
  it("preserves plugin arguments when progress metadata is replaced", async () => {
    const getMetadata = vi
      .fn()
      .mockResolvedValueOnce(
        ok({
          core: {
            actionKind: "record",
          },
          plugin: {
            arguments: {
              playlistUrl: "http://localhost:3401/streams/live-1.m3u8",
              streamId: "live-1",
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        ok({
          core: {
            actionKind: "record",
          },
          plugin: {
            arguments: {
              playlistUrl: "http://localhost:3401/streams/live-1.m3u8",
              streamId: "live-1",
            },
          },
        }),
      );
    const replaceMetadata = vi.fn(() => Promise.resolve(ok(undefined)));

    const result = await handleRecordContentJob(
      {
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
      {
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
          getMetadata,
          markRunning: vi.fn(() => Promise.resolve(ok(undefined))),
          markSucceeded: vi.fn(() => Promise.resolve(ok(undefined))),
          replaceMetadata,
        } as never,
        logger: createNoopLogger(),
        sourceCollectorRegistry: {
          get: vi.fn(() => ({
            record: vi.fn(
              async (
                input: SourceCollectorRecordInput,
              ): Promise<RecordedAsset> => {
                await input.context.replacePluginMetadata?.({
                  progress: {
                    phase: "fetching",
                  },
                });

                return {
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
                };
              },
            ),
          })),
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
      },
    );

    expect(result).toEqual(ok(undefined));
    expect(replaceMetadata).toHaveBeenCalledWith("record-job-1", {
      core: {
        actionKind: "record",
      },
      plugin: {
        arguments: {
          playlistUrl: "http://localhost:3401/streams/live-1.m3u8",
          streamId: "live-1",
        },
        progress: {
          phase: "fetching",
        },
      },
    });
  });
});
