import type { Kysely } from "kysely";
import { v7 as uuidv7 } from "uuid";

import { JobRepository } from "../db/job-repository.js";
import type {
  TranscriptListItem,
  TranscriptRecord,
} from "../db/transcript-repository.js";
import { TranscriptRepository } from "../db/transcript-repository.js";
import type { GeshiDatabase } from "../db/types.js";
import type { JobQueue } from "../job-queue/types.js";
import { TRANSCRIPT_SPLIT_JOB_NAME } from "../job-queue/types.js";
import type { Result } from "../lib/result.js";
import { err, ok } from "../lib/result.js";
import type { AssetService } from "./asset-service.js";

export type EnqueueTranscriptResult = {
  createdTranscriptCount: number;
  skippedTranscriptCount: number;
  transcripts: TranscriptRecord[];
};

export type RetryTranscriptResult = {
  jobId: string;
  transcriptId: string;
};

export type TranscriptServiceError =
  | {
      code: "content_has_no_audio_assets";
      message: string;
    }
  | {
      code: "transcript_not_found";
      message: string;
    }
  | {
      code: "transcript_retry_not_available";
      message: string;
    }
  | Error;

class TranscriptServiceOperationError extends Error {
  public constructor(
    public readonly code:
      | "transcript_not_found"
      | "transcript_retry_not_available",
    message: string,
  ) {
    super(message);
  }
}

export interface TranscriptService {
  enqueueTranscriptsForContent(
    contentId: string,
  ): Promise<Result<EnqueueTranscriptResult, TranscriptServiceError>>;
  listTranscriptsByContentId(
    contentId: string,
  ): Promise<Result<TranscriptListItem[], TranscriptServiceError>>;
  retryTranscript(
    contentId: string,
    transcriptId: string,
  ): Promise<Result<RetryTranscriptResult, TranscriptServiceError>>;
}

export function createTranscriptService(
  assetService: AssetService,
  database: Kysely<GeshiDatabase>,
  jobQueue: JobQueue,
  jobRepository: JobRepository,
  transcriptRepository: TranscriptRepository,
): TranscriptService {
  return {
    async enqueueTranscriptsForContent(
      contentId: string,
    ): Promise<Result<EnqueueTranscriptResult, TranscriptServiceError>> {
      const targets =
        await assetService.listAudioTranscriptionTargetsByContentId(contentId);

      if (!targets.ok) {
        return targets;
      }

      if (targets.value.length === 0) {
        return err({
          code: "content_has_no_audio_assets",
          message: "Audio assets were not found for transcript generation.",
        });
      }

      let createdTranscriptCount = 0;
      let skippedTranscriptCount = 0;
      const transcripts: TranscriptRecord[] = [];

      for (const target of targets.value) {
        if (target.storageKey === null) {
          skippedTranscriptCount += 1;
          continue;
        }

        let reservation: {
          splitJob: { id: string };
          transcript: TranscriptRecord;
        } | null;

        try {
          reservation = await database
            .transaction()
            .execute(async (transaction) => {
              const transactionTranscriptRepository = new TranscriptRepository(
                transaction,
              );
              const transactionJobRepository = new JobRepository(transaction);

              await transaction
                .selectFrom("asset_snapshots")
                .select(["id"])
                .where("id", "=", target.assetSnapshotId)
                .forUpdate()
                .executeTakeFirstOrThrow();

              const activeTranscript =
                await transactionTranscriptRepository.findQueuedOrRunningTranscriptByAssetSnapshotId(
                  target.assetSnapshotId,
                );

              if (!activeTranscript.ok) {
                throw activeTranscript.error;
              }

              if (activeTranscript.value !== null) {
                return null;
              }

              const generationResult =
                await transactionTranscriptRepository.findLatestTranscriptGenerationByAssetSnapshotId(
                  target.assetSnapshotId,
                );

              if (!generationResult.ok) {
                throw generationResult.error;
              }

              const transcript =
                await transactionTranscriptRepository.createTranscript({
                  contentId,
                  generation: generationResult.value + 1,
                  kind: "transcript",
                  sourceAssetSnapshotId: target.assetSnapshotId,
                  status: "queued",
                });

              if (!transcript.ok) {
                throw transcript.error;
              }

              const splitJob = await transactionJobRepository.createJob({
                id: uuidv7(),
                kind: TRANSCRIPT_SPLIT_JOB_NAME,
                retryable: true,
                sourceId: null,
              });

              if (!splitJob.ok) {
                throw splitJob.error;
              }

              return {
                splitJob: splitJob.value,
                transcript: transcript.value,
              };
            });
        } catch (error) {
          return err(toTranscriptServiceError(error));
        }

        if (reservation === null) {
          skippedTranscriptCount += 1;
          continue;
        }

        const queueJobId = await jobQueue.enqueue(TRANSCRIPT_SPLIT_JOB_NAME, {
          jobId: reservation.splitJob.id,
          mode: "initial",
          transcriptId: reservation.transcript.id,
        });

        const attachQueueJobIdResult = await jobRepository.attachQueueJobId(
          reservation.splitJob.id,
          queueJobId,
        );

        if (!attachQueueJobIdResult.ok) {
          return attachQueueJobIdResult;
        }

        transcripts.push(reservation.transcript);
        createdTranscriptCount += 1;
      }

      return ok({
        createdTranscriptCount,
        skippedTranscriptCount,
        transcripts,
      });
    },

    async listTranscriptsByContentId(
      contentId: string,
    ): Promise<Result<TranscriptListItem[], TranscriptServiceError>> {
      return transcriptRepository.listTranscriptsByContentId(contentId);
    },

    async retryTranscript(
      contentId: string,
      transcriptId: string,
    ): Promise<Result<RetryTranscriptResult, TranscriptServiceError>> {
      const transcript =
        await transcriptRepository.findTranscriptById(transcriptId);

      if (!transcript.ok) {
        return transcript;
      }

      if (
        transcript.value === null ||
        transcript.value.contentId !== contentId
      ) {
        return err({
          code: "transcript_not_found",
          message: "Transcript was not found.",
        });
      }

      let reservedRetry: { id: string };

      try {
        reservedRetry = await database
          .transaction()
          .execute(async (transaction) => {
            const transactionTranscriptRepository = new TranscriptRepository(
              transaction,
            );
            const transactionJobRepository = new JobRepository(transaction);

            const lockedTranscript = await transaction
              .selectFrom("transcripts")
              .select(["id", "status", "content_id"])
              .where("id", "=", transcriptId)
              .forUpdate()
              .executeTakeFirst();

            if (
              lockedTranscript === undefined ||
              lockedTranscript.content_id !== contentId
            ) {
              throw new TranscriptServiceOperationError(
                "transcript_not_found",
                "Transcript was not found.",
              );
            }

            if (
              lockedTranscript.status === "queued" ||
              lockedTranscript.status === "running"
            ) {
              throw new TranscriptServiceOperationError(
                "transcript_retry_not_available",
                "Transcript retry is not available.",
              );
            }

            const retryableChunks =
              await transactionTranscriptRepository.listRetryableTranscriptChunks(
                transcriptId,
              );

            if (!retryableChunks.ok) {
              throw retryableChunks.error;
            }

            if (retryableChunks.value.length === 0) {
              throw new TranscriptServiceOperationError(
                "transcript_retry_not_available",
                "Transcript retry is not available.",
              );
            }

            const markRunningResult =
              await transactionTranscriptRepository.markTranscriptRunning(
                transcriptId,
              );

            if (!markRunningResult.ok) {
              throw markRunningResult.error;
            }

            const splitJob = await transactionJobRepository.createJob({
              id: uuidv7(),
              kind: TRANSCRIPT_SPLIT_JOB_NAME,
              retryable: true,
              sourceId: null,
            });

            if (!splitJob.ok) {
              throw splitJob.error;
            }

            return splitJob.value;
          });
      } catch (error) {
        return err(toTranscriptServiceError(error));
      }

      const queueJobId = await jobQueue.enqueue(TRANSCRIPT_SPLIT_JOB_NAME, {
        jobId: reservedRetry.id,
        mode: "retry-failed",
        transcriptId,
      });

      const attachQueueJobIdResult = await jobRepository.attachQueueJobId(
        reservedRetry.id,
        queueJobId,
      );

      if (!attachQueueJobIdResult.ok) {
        return attachQueueJobIdResult;
      }

      return ok({
        jobId: reservedRetry.id,
        transcriptId,
      });
    },
  };
}

function toTranscriptServiceError(error: unknown): TranscriptServiceError {
  if (error instanceof TranscriptServiceOperationError) {
    return {
      code: error.code,
      message: error.message,
    };
  }

  if (isTranscriptServiceError(error)) {
    return error;
  }

  return error instanceof Error
    ? error
    : new Error("Transcript operation failed.");
}

function isTranscriptServiceError(
  error: unknown,
): error is Exclude<TranscriptServiceError, Error> {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error
  );
}
