import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createScribeClient,
  ScribeRequestTimeoutError,
} from "../../src/integrations/scribe-client.js";
import { assertErr } from "../support/result.js";

describe("scribe client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("times out transcription status polling requests", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: string, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        });
      }),
    );

    const client = createScribeClient("http://scribe.test", {
      requestTimeoutMs: 100,
    });
    const resultPromise = client.getTranscription("request-1");

    await vi.advanceTimersByTimeAsync(100);

    const result = await resultPromise;

    assertErr(result);
    expect(result.error).toBeInstanceOf(ScribeRequestTimeoutError);
    expect(result.error.message).toContain("100ms");
  });

  it("times out transcription enqueue requests", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: string, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        });
      }),
    );

    const client = createScribeClient("http://scribe.test", {
      requestTimeoutMs: 100,
    });
    const resultPromise = client.requestTranscription({
      body: new Uint8Array([1, 2, 3]),
      language: "ja",
    });

    await vi.advanceTimersByTimeAsync(100);

    const result = await resultPromise;

    assertErr(result);
    expect(result.error).toBeInstanceOf(ScribeRequestTimeoutError);
    expect(result.error.message).toContain("100ms");
  });
});
