import { EventEmitter } from "node:events";

import { describe, expect, it, vi } from "vitest";

import { plugin } from "../src/index.js";

const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));

describe("sampleStreaming plugin", () => {
  it("supports localhost stream URLs only", async () => {
    await expect(
      plugin.supports({
        config: {},
        logger: createNoopPluginLogger(),
        sourceUrl: "http://localhost:3401/sources/streams/live-1",
      }),
    ).resolves.toEqual({ supported: true });

    await expect(
      plugin.supports({
        config: {},
        logger: createNoopPluginLogger(),
        sourceUrl: "http://127.0.0.1:3401/sources/streams/live-1",
      }),
    ).resolves.toEqual({ supported: false });
  });

  it("observes a recording asset with record next action", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              description: "Fixture stream",
              id: "live-1",
              playlistUrl: "http://localhost:3401/streams/live-1.m3u8",
              scheduledStartAt: "2026-05-05T00:00:00.000Z",
              title: "Live 1",
            }),
            {
              headers: {
                "content-type": "application/json",
              },
              status: 200,
            },
          ),
        ),
      ),
    );

    const result = await plugin.observe({
      abortSignal: new AbortController().signal,
      config: {},
      logger: createNoopPluginLogger(),
      sourceUrl: "http://localhost:3401/sources/streams/live-1",
    });

    expect(result.contents).toHaveLength(1);
    expect(result.contents[0]?.assets[0]?.nextAction).toEqual({
      actionKind: "record",
      arguments: {
        playlistUrl: "http://localhost:3401/streams/live-1.m3u8",
        streamId: "live-1",
      },
      scheduledStartAt: new Date("2026-05-05T00:00:00.000Z"),
    });
  });

  it("records by transcoding playlistUrl from arguments", async () => {
    spawnMock.mockImplementation(() =>
      createSuccessfulFfmpegProcess([1, 2, 3]),
    );
    const replacePluginMetadata = vi.fn(() => Promise.resolve());

    const result = await plugin.record?.({
      abortSignal: new AbortController().signal,
      arguments: {
        playlistUrl: "http://localhost:3401/streams/live-1.m3u8",
      },
      asset: {
        kind: "audio",
        observedFingerprints: ["sample-stream-observed:a"],
        primary: true,
        sourceUrl: "http://localhost:3401/streams/live-1.m3u8",
      },
      config: {},
      content: {
        externalId: "live-1",
        kind: "stream-recording",
        publishedAt: null,
        status: "discovered",
        summary: null,
        title: "Live 1",
      },
      context: {
        replacePluginMetadata,
      },
      logger: createNoopPluginLogger(),
    });

    expect(result?.contentType).toBe("audio/mpeg");
    expect(result?.body).toEqual(new Uint8Array([1, 2, 3]));
    expect(replacePluginMetadata).toHaveBeenCalledTimes(2);
    expect(spawnMock).toHaveBeenCalledWith("ffmpeg", [
      "-i",
      "http://localhost:3401/streams/live-1.m3u8",
      "-vn",
      "-c:a",
      "copy",
      "-f",
      "mp3",
      "pipe:1",
    ]);
    expect(replacePluginMetadata).toHaveBeenNthCalledWith(1, {
      progress: {
        phase: "recording",
        playlistUrl: "http://localhost:3401/streams/live-1.m3u8",
      },
    });
    expect(replacePluginMetadata).toHaveBeenNthCalledWith(2, {
      progress: {
        byteLength: 3,
        phase: "completed",
      },
    });
  });
});

function createNoopPluginLogger() {
  return {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  };
}

function createSuccessfulFfmpegProcess(output: number[]) {
  const process = new EventEmitter() as EventEmitter & {
    kill: ReturnType<typeof vi.fn>;
    stderr: EventEmitter;
    stdout: EventEmitter;
  };

  process.kill = vi.fn();
  process.stdout = new EventEmitter();
  process.stderr = new EventEmitter();

  queueMicrotask(() => {
    process.stdout.emit("data", Buffer.from(output));
    process.emit("close", 0);
  });

  return process;
}
