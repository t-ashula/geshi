import type { Result } from "../lib/result.js";
import { err, ok } from "../lib/result.js";

export type ScribeTranscriptionStatus =
  | { status: "pending" | "working" }
  | { error: string | null; status: "error" }
  | { status: "done"; text: string | null };

export type ScribeClient = {
  getTranscription(
    requestId: string,
  ): Promise<Result<ScribeTranscriptionStatus, Error>>;
  requestTranscription(input: {
    body: Uint8Array;
    language: string;
  }): Promise<Result<{ requestId: string }, Error>>;
};

export function createScribeClient(baseUrl: string): ScribeClient {
  return {
    async getTranscription(
      requestId: string,
    ): Promise<Result<ScribeTranscriptionStatus, Error>> {
      try {
        const response = await fetch(`${baseUrl}/transcribe/${requestId}`);

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

        const response = await fetch(`${baseUrl}/transcribe`, {
          body: formData,
          method: "POST",
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
