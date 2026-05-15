import type { Result } from "../lib/result.js";
import { err, ok } from "../lib/result.js";

const DEFAULT_SCRIBE_REQUEST_TIMEOUT_MS = 30_000;

export type ScribeTranscriptionStatus =
  | { status: "pending" | "working" }
  | { error: string | null; status: "error" }
  | { status: "done"; text: string | null };

export class ScribeRequestTimeoutError extends Error {}

export type ScribeClient = {
  getTranscription(
    requestId: string,
  ): Promise<Result<ScribeTranscriptionStatus, Error>>;
  requestTranscription(input: {
    body: Uint8Array;
    language: string;
  }): Promise<Result<{ requestId: string }, Error>>;
};

export function createScribeClient(
  baseUrl: string,
  options?: {
    requestTimeoutMs?: number;
  },
): ScribeClient {
  const requestTimeoutMs =
    options?.requestTimeoutMs ?? DEFAULT_SCRIBE_REQUEST_TIMEOUT_MS;

  return {
    async getTranscription(
      requestId: string,
    ): Promise<Result<ScribeTranscriptionStatus, Error>> {
      try {
        const response = await fetchWithTimeout(
          `${baseUrl}/transcribe/${requestId}`,
          {
            timeoutMs: requestTimeoutMs,
          },
        );

        if (!response.ok) {
          return err(
            new Error(
              `Failed to get scribe transcription status: ${requestId}`,
            ),
          );
        }

        const payload = (await response.json()) as {
          error?: string;
          status: "pending" | "working" | "done" | "error";
          text?: string | null;
        };

        if (payload.status === "done") {
          return ok({
            status: "done",
            text: payload.text ?? null,
          });
        }

        if (payload.status === "error") {
          return ok({
            error: payload.error ?? null,
            status: "error",
          });
        }

        return ok({
          status: payload.status,
        });
      } catch (error) {
        return err(
          error instanceof Error
            ? error
            : new Error("Failed to get scribe transcription status."),
        );
      }
    },

    async requestTranscription(input: {
      body: Uint8Array;
      language: string;
    }): Promise<Result<{ requestId: string }, Error>> {
      try {
        const formData = new FormData();
        formData.append(
          "file",
          new File([Buffer.from(input.body)], "chunk.wav", {
            type: "audio/x-wav",
          }),
        );
        formData.append("language", input.language);
        formData.append("model", "base");

        const response = await fetchWithTimeout(`${baseUrl}/transcribe`, {
          body: formData,
          method: "POST",
          timeoutMs: requestTimeoutMs,
        });

        if (!response.ok) {
          return err(
            new Error("Failed to enqueue scribe transcription request."),
          );
        }

        const payload = (await response.json()) as {
          request_id: string;
        };

        return ok({
          requestId: payload.request_id,
        });
      } catch (error) {
        return err(
          error instanceof Error
            ? error
            : new Error("Failed to enqueue scribe transcription request."),
        );
      }
    },
  };
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit & {
    timeoutMs: number;
  },
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, init.timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "AbortError" || error.name === "TimeoutError")
    ) {
      throw new ScribeRequestTimeoutError(
        `Scribe request timed out after ${init.timeoutMs}ms.`,
      );
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
