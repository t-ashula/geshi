import { spawn } from "node:child_process";

import type {
  RecordedAsset,
  SourceCollectorAcquireInput,
  SourceCollectorInspectErrorCode,
  SourceCollectorInspectInput,
  SourceCollectorObserveInput,
  SourceCollectorObserveResult,
  SourceCollectorPlugin,
  SourceCollectorPluginDefinition,
  SourceCollectorRecordInput,
  SourceCollectorSupportsInput,
} from "@geshi/sdk";

import { manifest } from "./manifest.js";

const DEFAULT_CONTENT_TYPE = "audio/mpeg";

class SourceCollectorInspectPluginError extends Error {
  public readonly code: SourceCollectorInspectErrorCode;

  public constructor(code: SourceCollectorInspectErrorCode, message: string) {
    super(message);
    this.name = "SourceCollectorInspectPluginError";
    this.code = code;
  }
}

type StreamDescriptor = {
  description: string | null;
  id: string;
  playlistUrl: string;
  scheduledStartAt: string | null;
  title: string;
};

export const plugin: SourceCollectorPlugin = {
  supports(
    input: SourceCollectorSupportsInput,
  ): Promise<{ supported: boolean }> {
    return Promise.resolve({
      supported: isSupportedSourceUrl(input.sourceUrl),
    });
  },

  async inspect(input: SourceCollectorInspectInput) {
    const descriptor = await fetchStreamDescriptor(
      input.sourceUrl,
      input.abortSignal,
    );

    return {
      description: descriptor.description,
      title: descriptor.title,
      url: input.sourceUrl,
    };
  },

  async observe(
    input: SourceCollectorObserveInput,
  ): Promise<SourceCollectorObserveResult> {
    const descriptor = await fetchStreamDescriptor(
      input.sourceUrl,
      input.abortSignal,
    );

    return {
      contents: [
        {
          assets: [
            {
              kind: "audio",
              nextAction: {
                actionKind: "record",
                arguments: {
                  playlistUrl: descriptor.playlistUrl,
                  streamId: descriptor.id,
                },
                scheduledStartAt:
                  descriptor.scheduledStartAt === null
                    ? null
                    : new Date(descriptor.scheduledStartAt),
              },
              observedFingerprints: [
                createFingerprint(
                  "sample-stream-observed",
                  descriptor.playlistUrl,
                ),
              ],
              primary: true,
              sourceUrl: descriptor.playlistUrl,
            },
          ],
          contentFingerprints: [
            createFingerprint("sample-stream-content", descriptor.id),
          ],
          externalId: descriptor.id,
          kind: "stream-recording",
          publishedAt:
            descriptor.scheduledStartAt === null
              ? null
              : new Date(descriptor.scheduledStartAt),
          status: "discovered",
          summary: descriptor.description,
          title: descriptor.title,
        },
      ],
    };
  },

  acquire(_input: SourceCollectorAcquireInput): Promise<RecordedAsset> {
    return Promise.reject(
      new Error(
        "sample-streaming assets must be handled by record(), not acquire().",
      ),
    );
  },

  async record(input: SourceCollectorRecordInput): Promise<RecordedAsset> {
    const playlistUrl =
      typeof input.arguments.playlistUrl === "string"
        ? input.arguments.playlistUrl
        : null;

    if (playlistUrl === null) {
      throw new Error(
        "sample-streaming record() requires arguments.playlistUrl.",
      );
    }

    await input.context.replacePluginMetadata?.({
      progress: {
        phase: "recording",
        playlistUrl,
      },
    });

    const body = await transcodePlaylistToMp3(playlistUrl, input.abortSignal);

    await input.context.replacePluginMetadata?.({
      progress: {
        byteLength: body.byteLength,
        phase: "completed",
      },
    });

    return {
      acquiredFingerprints: [
        createFingerprint(
          "sample-stream-recorded",
          `${playlistUrl}:${body.byteLength}`,
        ),
      ],
      body,
      contentType: DEFAULT_CONTENT_TYPE,
      kind: input.asset.kind,
      metadata: {},
      primary: input.asset.primary,
      sourceUrl: playlistUrl,
    };
  },
};

export const definition: SourceCollectorPluginDefinition = {
  manifest,
  plugin,
};

async function fetchStreamDescriptor(
  sourceUrl: string,
  abortSignal: AbortSignal,
): Promise<StreamDescriptor> {
  assertSupportedSourceUrl(sourceUrl);

  let response: Response;

  try {
    response = await fetch(sourceUrl, {
      signal: abortSignal,
    });
  } catch {
    throw new SourceCollectorInspectPluginError(
      "source_inspect_fetch_failed",
      "Failed to fetch sample streaming source.",
    );
  }

  if (!response.ok) {
    throw new SourceCollectorInspectPluginError(
      "source_inspect_fetch_failed",
      "Failed to fetch sample streaming source.",
    );
  }

  const payload = (await response.json()) as Partial<StreamDescriptor>;

  if (
    typeof payload.id !== "string" ||
    typeof payload.playlistUrl !== "string" ||
    typeof payload.title !== "string"
  ) {
    throw new SourceCollectorInspectPluginError(
      "source_inspect_unrecognized",
      "Failed to recognize the sample streaming source metadata.",
    );
  }

  return {
    description:
      typeof payload.description === "string" ? payload.description : null,
    id: payload.id,
    playlistUrl: payload.playlistUrl,
    scheduledStartAt:
      typeof payload.scheduledStartAt === "string"
        ? payload.scheduledStartAt
        : null,
    title: payload.title,
  };
}

function assertSupportedSourceUrl(sourceUrl: string): void {
  if (!isSupportedSourceUrl(sourceUrl)) {
    throw new SourceCollectorInspectPluginError(
      "source_inspect_unsupported",
      "The sample-streaming plugin only supports localhost /sources/streams/:id URLs.",
    );
  }
}

function isSupportedSourceUrl(sourceUrl: string): boolean {
  const url = new URL(sourceUrl);

  return (
    url.hostname === "localhost" &&
    /^\/sources\/streams\/[^/]+$/.test(url.pathname)
  );
}

function createFingerprint(kind: string, value: string): string {
  return `${kind}:${value}`;
}

async function transcodePlaylistToMp3(
  playlistUrl: string,
  abortSignal: AbortSignal,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i",
      playlistUrl,
      "-vn",
      "-c:a",
      "copy",
      "-f",
      "mp3",
      "pipe:1",
    ]);
    const stdoutChunks: Uint8Array[] = [];
    const stderrChunks: Buffer[] = [];

    const abortHandler = () => {
      ffmpeg.kill("SIGTERM");
      reject(new Error("sample-streaming record() aborted."));
    };

    abortSignal.addEventListener("abort", abortHandler, { once: true });

    ffmpeg.stdout.on("data", (chunk: Buffer) => {
      stdoutChunks.push(new Uint8Array(chunk));
    });

    ffmpeg.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });

    ffmpeg.on("error", (error) => {
      abortSignal.removeEventListener("abort", abortHandler);
      reject(error);
    });

    ffmpeg.on("close", (code) => {
      abortSignal.removeEventListener("abort", abortHandler);

      if (code !== 0) {
        const detail = Buffer.concat(stderrChunks).toString("utf8").trim();
        reject(
          new Error(
            `ffmpeg failed while recording sample stream: ${detail || code}`,
          ),
        );
        return;
      }

      resolve(concatUint8Arrays(stdoutChunks));
    });
  });
}

function concatUint8Arrays(chunks: Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return result;
}
