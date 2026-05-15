import { describe, expect, it, vi } from "vitest";

import { ScribeRequestTimeoutError } from "../../src/integrations/scribe-client.js";
import { ok } from "../../src/lib/result.js";
import { handleTranscriptChunkJob } from "../../src/workers/transcript-chunk/handle.js";
import { assertOk } from "../support/result.js";

describe("handleTranscriptChunkJob", () => {
  it("marks chunk and transcript timed out when scribe enqueue hangs", async () => {
    const markRunning = vi.fn(() => Promise.resolve(ok(undefined)));
    const markTranscriptChunkRunning = vi.fn(() =>
      Promise.resolve(ok(undefined)),
    );
    const getMetadata = vi.fn(() => Promise.resolve(ok({})));
    const workStorageGet = vi.fn(() =>
      Promise.resolve(ok(new Uint8Array([1, 2, 3]))),
    );
    const requestTranscription = vi.fn(() =>
      Promise.resolve({
        ok: false,
        error: new ScribeRequestTimeoutError(
          "Scribe request timed out after 100ms.",
        ),
      } as const),
    );
    const markTranscriptChunkFailed = vi.fn(() =>
      Promise.resolve(ok(undefined)),
    );
    const markFailed = vi.fn(() => Promise.resolve(ok(undefined)));
    const listTranscriptChunksByTranscriptId = vi.fn(() =>
      Promise.resolve(
        ok([
          {
            body: null,
            chunkIndex: 1,
            failureMessage: "Scribe request timed out after 100ms.",
            finishedAt: new Date("2026-05-13T00:00:00.000Z"),
            id: "chunk-1",
            sourceEndMs: 2000,
            sourceStartMs: 0,
            startedAt: new Date("2026-05-13T00:00:00.000Z"),
            status: "timed_out",
            storageKey: "transcripts/transcript-1/chunk-0001.wav",
            transcriptId: "transcript-1",
          },
        ]),
      ),
    );
    const markTranscriptFailed = vi.fn(() => Promise.resolve(ok(undefined)));
    const workStorageDelete = vi.fn(() => Promise.resolve(ok(undefined)));

    const result = await handleTranscriptChunkJob(
      {
        chunkIndex: 1,
        jobId: "job-1",
        storageKey: "transcripts/transcript-1/chunk-0001.wav",
        transcriptChunkId: "chunk-1",
        transcriptId: "transcript-1",
      },
      {
        jobRepository: {
          getMetadata,
          markFailed,
          markRunning,
          markSucceeded: vi.fn(),
          replaceMetadata: vi.fn(),
        } as never,
        logger: {
          child: vi.fn(() => ({
            info: vi.fn(),
          })),
        } as never,
        scribeClient: {
          getTranscription: vi.fn(),
          requestTranscription,
        },
        transcriptRepository: {
          listTranscriptChunksByTranscriptId,
          markTranscriptChunkFailed,
          markTranscriptChunkRunning,
          markTranscriptFailed,
          markTranscriptSucceeded: vi.fn(),
        } as never,
        workStorage: {
          delete: workStorageDelete,
          get: workStorageGet,
        } as never,
      },
    );

    assertOk(result);
    expect(markRunning).toHaveBeenCalledWith("job-1");
    expect(markTranscriptChunkRunning).toHaveBeenCalledWith("chunk-1");
    expect(requestTranscription).toHaveBeenCalledTimes(1);
    expect(markTranscriptChunkFailed).toHaveBeenCalledWith(
      "chunk-1",
      "Scribe request timed out after 100ms.",
      "timed_out",
    );
    expect(markFailed).toHaveBeenCalledWith(
      "job-1",
      "Scribe request timed out after 100ms.",
      true,
    );
    expect(markTranscriptFailed).toHaveBeenCalledWith("transcript-1");
    expect(workStorageDelete).toHaveBeenCalledWith(
      "transcripts/transcript-1/chunk-0001.wav",
    );
  });
});
