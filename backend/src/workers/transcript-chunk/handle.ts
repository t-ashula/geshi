import type { JobRepository } from "../../db/job-repository.js";
import type { TranscriptRepository } from "../../db/transcript-repository.js";
import type { ScribeClient } from "../../integrations/scribe-client.js";
import type { TranscriptChunkJobPayload } from "../../job-queue/types.js";
import type { Result } from "../../lib/result.js";
import { err, ok } from "../../lib/result.js";
import type { Logger } from "../../logger/index.js";
import type { Storage } from "../../storage/types.js";

const SCRIBE_POLL_INTERVAL_MS = 5_000;
const SCRIBE_POLL_TIMEOUT_MS = 10 * 60 * 1_000;

type HandleTranscriptChunkJobDependencies = {
  jobRepository: JobRepository;
  logger: Logger;
  scribeClient: ScribeClient;
  transcriptRepository: TranscriptRepository;
  workStorage: Storage;
};

export async function handleTranscriptChunkJob(
  payload: TranscriptChunkJobPayload,
  dependencies: HandleTranscriptChunkJobDependencies,
): Promise<Result<void, Error>> {
  const logger = dependencies.logger.child({
    chunkIndex: payload.chunkIndex,
    jobId: payload.jobId,
    transcriptChunkId: payload.transcriptChunkId,
    transcriptId: payload.transcriptId,
  });
  const markRunningResult = await dependencies.jobRepository.markRunning(
    payload.jobId,
  );

  if (!markRunningResult.ok) {
    return markRunningResult;
  }

  const markTranscriptChunkRunningResult =
    await dependencies.transcriptRepository.markTranscriptChunkRunning(
      payload.transcriptChunkId,
    );

  if (!markTranscriptChunkRunningResult.ok) {
    await dependencies.jobRepository.markFailed(
      payload.jobId,
      markTranscriptChunkRunningResult.error.message,
      true,
    );
    return err(markTranscriptChunkRunningResult.error);
  }

  const metadataResult = await dependencies.jobRepository.getMetadata(
    payload.jobId,
  );

  if (!metadataResult.ok) {
    return metadataResult;
  }

  let scribeRequestId =
    typeof metadataResult.value.scribeRequestId === "string"
      ? metadataResult.value.scribeRequestId
      : null;

  if (scribeRequestId === null) {
    const chunkBodyResult = await dependencies.workStorage.get(
      payload.storageKey,
    );

    if (!chunkBodyResult.ok) {
      return chunkBodyResult;
    }

    const requestTranscriptionResult =
      await dependencies.scribeClient.requestTranscription({
        body: chunkBodyResult.value,
        language: "ja",
      });

    if (!requestTranscriptionResult.ok) {
      return requestTranscriptionResult;
    }

    scribeRequestId = requestTranscriptionResult.value.requestId;
    const replaceMetadataResult =
      await dependencies.jobRepository.replaceMetadata(payload.jobId, {
        scribeRequestId,
      });

    if (!replaceMetadataResult.ok) {
      return replaceMetadataResult;
    }
  }

  const startedAt = Date.now();

  while (Date.now() - startedAt < SCRIBE_POLL_TIMEOUT_MS) {
    const status =
      await dependencies.scribeClient.getTranscription(scribeRequestId);

    if (!status.ok) {
      return status;
    }

    if (
      status.value.status === "pending" ||
      status.value.status === "working"
    ) {
      await delay(SCRIBE_POLL_INTERVAL_MS);
      continue;
    }

    if (status.value.status === "done") {
      const markSucceededResult =
        await dependencies.transcriptRepository.markTranscriptChunkSucceeded(
          payload.transcriptChunkId,
          status.value.text ?? "",
        );

      if (!markSucceededResult.ok) {
        return err(markSucceededResult.error);
      }

      const markJobSucceededResult =
        await dependencies.jobRepository.markSucceeded(payload.jobId);

      if (!markJobSucceededResult.ok) {
        return markJobSucceededResult;
      }

      await updateTranscriptAggregate(
        payload.transcriptId,
        dependencies.transcriptRepository,
        dependencies.workStorage,
      );
      logger.info("transcript chunk completed.");
      return ok(undefined);
    }

    if (status.value.status !== "error") {
      await delay(SCRIBE_POLL_INTERVAL_MS);
      continue;
    }

    const failureMessage = status.value.error ?? "Scribe transcription failed.";
    await dependencies.transcriptRepository.markTranscriptChunkFailed(
      payload.transcriptChunkId,
      failureMessage,
      "failed",
    );
    await dependencies.jobRepository.markFailed(
      payload.jobId,
      failureMessage,
      true,
    );
    await updateTranscriptAggregate(
      payload.transcriptId,
      dependencies.transcriptRepository,
      dependencies.workStorage,
    );
    return ok(undefined);
  }

  await dependencies.transcriptRepository.markTranscriptChunkFailed(
    payload.transcriptChunkId,
    "Scribe transcription timed out.",
    "timed_out",
  );
  await dependencies.jobRepository.markFailed(
    payload.jobId,
    "Scribe transcription timed out.",
    true,
  );
  await updateTranscriptAggregate(
    payload.transcriptId,
    dependencies.transcriptRepository,
    dependencies.workStorage,
  );

  return ok(undefined);
}

async function updateTranscriptAggregate(
  transcriptId: string,
  transcriptRepository: TranscriptRepository,
  workStorage: Storage,
): Promise<void> {
  const transcriptChunksResult =
    await transcriptRepository.listTranscriptChunksByTranscriptId(transcriptId);

  if (!transcriptChunksResult.ok) {
    return;
  }

  if (transcriptChunksResult.value.length === 0) {
    return;
  }

  const transcriptChunks = transcriptChunksResult.value;
  const hasQueuedOrRunningChunk = transcriptChunks.some(
    (transcriptChunk) =>
      transcriptChunk.status === "queued" ||
      transcriptChunk.status === "running",
  );

  if (hasQueuedOrRunningChunk) {
    return;
  }

  const hasFailedChunk = transcriptChunks.some(
    (transcriptChunk) =>
      transcriptChunk.status === "failed" ||
      transcriptChunk.status === "timed_out",
  );

  if (hasFailedChunk) {
    await transcriptRepository.markTranscriptFailed(transcriptId);
    await cleanupTranscriptChunkFiles(
      transcriptId,
      transcriptRepository,
      workStorage,
    );
    return;
  }

  const body = transcriptChunks
    .map((transcriptChunk) => transcriptChunk.body ?? "")
    .join("\n")
    .trim();
  await transcriptRepository.markTranscriptSucceeded(transcriptId, body);
  await cleanupTranscriptChunkFiles(
    transcriptId,
    transcriptRepository,
    workStorage,
  );
}

async function cleanupTranscriptChunkFiles(
  transcriptId: string,
  transcriptRepository: TranscriptRepository,
  workStorage: Storage,
): Promise<void> {
  const transcriptChunksResult =
    await transcriptRepository.listTranscriptChunksByTranscriptId(transcriptId);

  if (!transcriptChunksResult.ok) {
    return;
  }

  for (const transcriptChunk of transcriptChunksResult.value) {
    if (transcriptChunk.storageKey === null) {
      continue;
    }

    await workStorage.delete(transcriptChunk.storageKey);
  }
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
