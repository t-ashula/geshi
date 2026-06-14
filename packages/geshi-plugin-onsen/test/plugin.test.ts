import { EventEmitter } from "node:events";
import { writeFileSync } from "node:fs";

import {
  assertSourceCollectorObserveResultContract,
  WebClient,
} from "@geshi/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { plugin } from "../src/index.js";

const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));

function createNoopPluginLogger() {
  return {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  };
}

function createPluginContext() {
  return {
    getHost() {
      return {
        logger: createNoopPluginLogger(),
      };
    },
  };
}

describe("onsen plugin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("supports Onsen program URLs", async () => {
    await expect(
      plugin.supports(
        {
          config: {},
          sourceUrl: "https://www.onsen.ag/program/kakazu",
        },
        createPluginContext(),
      ),
    ).resolves.toEqual({ supported: true });

    await expect(
      plugin.supports(
        {
          config: {},
          sourceUrl: "https://example.com/program/kakazu",
        },
        createPluginContext(),
      ),
    ).resolves.toEqual({ supported: false });
  });

  it("inspects program metadata from Nuxt state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(createProgramPageHtml(), {
            headers: {
              "content-type": "text/html",
            },
            status: 200,
          }),
        ),
      ),
    );

    await expect(
      plugin.inspect(
        {
          abortSignal: new AbortController().signal,
          config: {},
          sourceUrl: "https://www.onsen.ag/program/test-show/",
        },
        createPluginContext(),
      ),
    ).resolves.toEqual({
      description: "番組の説明です",
      title: "テスト番組",
      url: "https://www.onsen.ag/program/test-show",
    });
  });

  it("detects program sources from the Onsen listing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(createListingPageHtml(), {
            headers: {
              "content-type": "text/html",
            },
            status: 200,
          }),
        ),
      ),
    );

    await expect(
      plugin.detectSources?.(
        {
          abortSignal: new AbortController().signal,
          config: {},
          detectorState: {
            cursor: "unchanged",
          },
          inputUrl: "https://www.onsen.ag",
        },
        createPluginContext(),
      ),
    ).resolves.toEqual({
      candidates: [
        {
          description: null,
          sourceSlug: "test-show",
          title: "テスト番組",
          url: "https://www.onsen.ag/program/test-show",
        },
        {
          description: null,
          sourceSlug: "new-show",
          title: "新番組",
          url: "https://www.onsen.ag/program/new-show",
        },
      ],
      detectorState: {
        cursor: "unchanged",
      },
    });
  });

  it("observes public and premium episodes from Nuxt state", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-05T12:00:00.000Z"));
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(createProgramPageHtml(), {
            headers: {
              "content-type": "text/html",
            },
            status: 200,
          }),
        ),
      ),
    );

    const result = await plugin.observe(
      {
        abortSignal: new AbortController().signal,
        config: {},
        sourceUrl: "https://www.onsen.ag/program/test-show",
      },
      createPluginContext(),
    );

    expect(() =>
      assertSourceCollectorObserveResultContract(result, {
        allowLegacyFingerprintsDuringMigration: false,
      }),
    ).not.toThrow();

    expect(result.contents).toHaveLength(3);
    expect(result.contents[0]).toMatchObject({
      externalId: "test-show:1001",
      kind: "podcast-episode",
      publishedAt: new Date("2026-06-02T00:00:00.000+09:00"),
      summary: "6/2\nGuest: ゲストA, ゲストB",
      title: "第10回",
    });
    expect(result.contents[0]?.assets[0]).toMatchObject({
      kind: "audio",
      nextAction: {
        actionKind: "acquire",
      },
      primary: true,
      sourceUrl: "https://cdn.example.com/test-show/202606/test-show-10.m3u8",
    });
    expect(result.contents[1]?.assets[0]?.nextAction).toEqual({
      actionKind: "none",
      message:
        "Audio stream is not publicly available for this episode on the current Onsen page.",
      reason: "requires-manual-action",
    });
    expect(result.contents[2]?.publishedAt).toEqual(
      new Date("2025-12-29T00:00:00.000+09:00"),
    );
  });

  it("acquires Onsen HLS audio through ffmpeg", async () => {
    spawnMock.mockImplementation((_command: string, args: string[]) =>
      createSuccessfulFfmpegProcess(String(args.at(-1)), [1, 2, 3, 4]),
    );

    const result = await plugin.acquire(
      {
        abortSignal: new AbortController().signal,
        asset: {
          kind: "audio",
          nextAction: {
            actionKind: "acquire",
          },
          observedFingerprints: ["fingerprint"],
          primary: true,
          sourceUrl:
            "https://cdn.example.com/test-show/202606/test-show-10.m3u8",
        },
        config: {},
        content: {
          externalId: "test-show:1001",
          kind: "podcast-episode",
          publishedAt: new Date("2026-06-02T00:00:00.000+09:00"),
          status: "discovered",
          summary: null,
          title: "第10回",
        },
      },
      createPluginContext(),
    );

    expect(result).toMatchObject({
      contentType: "audio/mp4",
      kind: "audio",
      primary: true,
      sourceUrl: "https://cdn.example.com/test-show/202606/test-show-10.m3u8",
    });
    expect(result.body).toEqual(new Uint8Array([1, 2, 3, 4]));
    expect(result.acquiredFingerprints[0]).toMatch(/^2026-06-05:[0-9a-f]{64}$/);
    expect(spawnMock).toHaveBeenCalledWith("ffmpeg", [
      "-loglevel",
      "error",
      "-y",
      "-headers",
      "Referer: https://www.onsen.ag/\r\nUser-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36\r\n",
      "-i",
      "https://cdn.example.com/test-show/202606/test-show-10.m3u8",
      "-vn",
      "-c:a",
      "copy",
      "-bsf:a",
      "aac_adtstoasc",
      "-f",
      "ipod",
      expect.stringMatching(/episode\.m4a$/),
    ]);
  });

  it("uses the fetch web client while inspecting", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(createProgramPageHtml(), {
          headers: {
            "content-type": "text/html",
          },
          status: 200,
        }),
      ),
    );
    const createWebClientSpy = vi
      .spyOn(WebClient, "create")
      .mockReturnValueOnce({
        fetch: fetchMock,
      });

    await plugin.inspect(
      {
        abortSignal: new AbortController().signal,
        config: {},
        sourceUrl: "https://www.onsen.ag/program/test-show",
      },
      createPluginContext(),
    );

    expect(createWebClientSpy).toHaveBeenCalledWith({
      kind: "fetch",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

function createProgramPageHtml(): string {
  return `<!doctype html>
  <html>
    <body>
      <script>window.__NUXT__=${JSON.stringify({
        state: {
          program: {
            program: {
              contents: [
                {
                  delivery_date: "6/2",
                  free: true,
                  guests: [{ name: "ゲストA" }, { name: "ゲストB" }],
                  id: 1001,
                  premium: false,
                  streaming_url:
                    "https://cdn.example.com/test-show/202606/test-show-10.m3u8",
                  title: "第10回",
                },
                {
                  delivery_date: "5/26",
                  free: false,
                  guests: [],
                  id: 1000,
                  premium: true,
                  streaming_url: null,
                  title: "第9回",
                },
                {
                  delivery_date: "12/29",
                  free: false,
                  guests: [],
                  id: 999,
                  premium: true,
                  streaming_url: null,
                  title: "第8回",
                },
              ],
              directory_name: "test-show",
              program_info: {
                description: "番組の説明です",
                directory_url: "https://www.onsen.ag/program/test-show",
                title: "テスト番組",
              },
            },
          },
        },
      })};</script>
    </body>
  </html>`;
}

function createListingPageHtml(): string {
  return `<!doctype html>
  <html>
    <body>
      <script>window.__NUXT__=${JSON.stringify({
        state: {
          programs: {
            programs: {
              1: [
                {
                  directory_name: "test-show",
                  title: "テスト番組",
                },
              ],
              all: [
                {
                  directory_name: "test-show",
                  title: "テスト番組",
                },
                {
                  directory_name: "new-show",
                  title: "新番組",
                },
              ],
              recommended: [
                {
                  directory_name: "new-show",
                  title: "新番組",
                },
              ],
            },
          },
        },
      })};</script>
    </body>
  </html>`;
}

function createSuccessfulFfmpegProcess(
  outputPath: string,
  bytes: number[],
): EventEmitter & {
  kill: ReturnType<typeof vi.fn>;
  stderr: EventEmitter;
} {
  const process = new EventEmitter() as EventEmitter & {
    kill: ReturnType<typeof vi.fn>;
    stderr: EventEmitter;
  };
  process.kill = vi.fn();
  process.stderr = new EventEmitter();
  writeFileSync(outputPath, Buffer.from(bytes));
  queueMicrotask(() => {
    process.emit("close", 0);
  });
  return process;
}
