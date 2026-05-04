import { v7 as uuidv7 } from "uuid";

import type { JobRepository } from "../../db/job-repository.js";
import type { TranscriptRepository } from "../../db/transcript-repository.js";
import type {
  JobQueue,
  TranscriptSplitJobPayload,
} from "../../job-queue/types.js";
import { TRANSCRIPT_CHUNK_JOB_NAME } from "../../job-queue/types.js";
import type { Result } from "../../lib/result.js";
import { err, ok } from "../../lib/result.js";
import {
  splitAudioIntoWavChunks,
  TRANSCRIPT_CHUNK_DURATION_SECONDS,
} from "../../lib/split-audio-into-wav-chunks.js";
import type { Logger } from "../../logger/index.js";
import type { Storage } from "../../storage/types.js";

type HandleTranscriptSplitJobDependencies = {
  jobQueue: JobQueue;
  jobRepository: JobRepository;
  logger: Logger;
  storage: Storage;
  transcriptRepository: TranscriptRepository;
  workStorage: Storage;
};

export async function handleTranscriptSplitJob(
  payload: TranscriptSplitJobPayload,
  dependencies: HandleTranscriptSplitJobDependencies,
): Promise<Result<void, Error>> {
  const logger = dependencies.logger.child({
    jobId: payload.jobId,
    transcriptId: payload.transcriptId,
  });
  const markRunningResult = await dependencies.jobRepository.markRunning(
    payload.jobId,
  );

  if (!markRunningResult.ok) {
    return markRunningResult;
  }

  const markTranscriptRunningResult =
    await dependencies.transcriptRepository.markTranscriptRunning(
      payload.transcriptId,
    );

  if (!markTranscriptRunningResult.ok) {
    await failTranscriptSplitJob(
      payload.jobId,
      payload.transcriptId,
      dependencies,
      markTranscriptRunningResult.error,
    );
    return err(markTranscriptRunningResult.error);
  }

  const transcriptSource =
    await dependencies.transcriptRepository.findTranscriptSourceAssetByTranscriptId(
      payload.transcriptId,
    );

  if (!transcriptSource.ok) {
    await failTranscriptSplitJob(
      payload.jobId,
      payload.transcriptId,
      dependencies,
      transcriptSource.error,
    );
    return err(transcriptSource.error);
  }

  if (
    transcriptSource.value === null ||
    transcriptSource.value.sourceStorageKey === null
  ) {
    const error = new Error("Transcript source audio is not stored.");
    await failTranscriptSplitJob(
      payload.jobId,
      payload.transcriptId,
      dependencies,
      error,
    );
    return ok(undefined);
  }

  const sourceBodyResult = await dependencies.storage.get(
    transcriptSource.value.sourceStorageKey,
  );

  if (!sourceBodyResult.ok) {
    await failTranscriptSplitJob(
      payload.jobId,
      payload.transcriptId,
      dependencies,
      sourceBodyResult.error,
    );
    return err(sourceBodyResult.error);
  }

  let splitChunks;

  try {
    splitChunks = await splitAudioIntoWavChunks(sourceBodyResult.value);
  } catch (error) {
    const splitError =
      error instanceof Error
        ? error
        : new Error("Failed to split transcript audio.");
    await failTranscriptSplitJob(
      payload.jobId,
      payload.transcriptId,
      dependencies,
      splitError,
    );
    return err(splitError);
  }

  if (splitChunks.length === 0) {
    const error = new Error("No transcript chunks were produced.");
    await failTranscriptSplitJob(
      payload.jobId,
      payload.transcriptId,
      dependencies,
      error,
    );
    return ok(undefined);
  }

  const retryableChunkIndexes =
    payload.mode === "retry-failed"
      ? await buildRetryableChunkIndexes(payload.transcriptId, dependencies)
      : null;

  if (retryableChunkIndexes instanceof Error) {
    await failTranscriptSplitJob(
      payload.jobId,
      payload.transcriptId,
      dependencies,
      retryableChunkIndexes,
    );
    return err(retryableChunkIndexes);
  }

  for (const splitChunk of splitChunks) {
    if (
      retryableChunkIndexes !== null &&
      !retryableChunkIndexes.has(splitChunk.chunkIndex)
    ) {
      continue;
    }

    const storageKey = dependencies.workStorage.pathJoin(
      "transcripts",
      payload.transcriptId,
      `chunk-${String(splitChunk.chunkIndex).padStart(4, "0")}.wav`,
    );
    const putResult = await dependencies.workStorage.put({
      body: splitChunk.body,
      contentType: "audio/x-wav",
      key: storageKey,
      overwrite: true,
    });

    if (!putResult.ok) {
      await failTranscriptSplitJob(
        payload.jobId,
        payload.transcriptId,
        dependencies,
        putResult.error,
      );
      return err(putResult.error);
    }

    const transcriptChunkResult =
      await dependencies.transcriptRepository.upsertTranscriptChunk({
        body: null,
        chunkIndex: splitChunk.chunkIndex,
        failureMessage: null,
        sourceEndMs: splitChunk.sourceEndMs,
        sourceStartMs: splitChunk.sourceStartMs,
        status: "queued",
        storageKey,
        transcriptId: payload.transcriptId,
      });

    if (!transcriptChunkResult.ok) {
      await failTranscriptSplitJob(
        payload.jobId,
        payload.transcriptId,
        dependencies,
        transcriptChunkResult.error,
      );
      return err(transcriptChunkResult.error);
    }

    const transcriptChunkJob = await dependencies.jobRepository.createJob({
      id: uuidv7(),
      kind: TRANSCRIPT_CHUNK_JOB_NAME,
      retryable: true,
      sourceId: null,
    });

    if (!transcriptChunkJob.ok) {
      await failTranscriptSplitJob(
        payload.jobId,
        payload.transcriptId,
        dependencies,
        transcriptChunkJob.error,
      );
      return err(transcriptChunkJob.error);
    }

    const queueJobId = await dependencies.jobQueue.enqueue(
      TRANSCRIPT_CHUNK_JOB_NAME,
      {
        chunkIndex: splitChunk.chunkIndex,
        jobId: transcriptChunkJob.value.id,
        storageKey,
        transcriptChunkId: transcriptChunkResult.value.id,
        transcriptId: payload.transcriptId,
      },
    );

    const attachQueueJobIdResult =
      await dependencies.jobRepository.attachQueueJobId(
        transcriptChunkJob.value.id,
        queueJobId,
      );

    if (!attachQueueJobIdResult.ok) {
      await failTranscriptSplitJob(
        payload.jobId,
        payload.transcriptId,
        dependencies,
        attachQueueJobIdResult.error,
      );
      return err(attachQueueJobIdResult.error);
    }
  }

  const markSucceededResult = await dependencies.jobRepository.markSucceeded(
    payload.jobId,
  );

  if (!markSucceededResult.ok) {
    return markSucceededResult;
  }

  logger.info("transcript split job completed.", {
    chunkDurationSeconds: TRANSCRIPT_CHUNK_DURATION_SECONDS,
    mode: payload.mode,
  });

  return ok(undefined);
}

async function failTranscriptSplitJob(
  jobId: string,
  transcriptId: string,
  dependencies: HandleTranscriptSplitJobDependencies,
  error: Error,
): Promise<void> {
  await dependencies.transcriptRepository.markTranscriptFailed(transcriptId);
  await dependencies.jobRepository.markFailed(jobId, error.message, true);
}

async function buildRetryableChunkIndexes(
  transcriptId: string,
  dependencies: HandleTranscriptSplitJobDependencies,
): Promise<Error | Set<number>> {
  const retryableChunksResult =
    await dependencies.transcriptRepository.listRetryableTranscriptChunks(
      transcriptId,
    );

  if (!retryableChunksResult.ok) {
    return retryableChunksResult.error;
  }

  return new Set(retryableChunksResult.value.map((chunk) => chunk.chunkIndex));
}
