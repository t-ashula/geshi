import type { Kysely, Selectable } from "kysely";
import { sql } from "kysely";

import type { Result } from "../lib/result.js";
import { err, ok } from "../lib/result.js";
import type {
  GeshiDatabase,
  TranscriptChunkTable,
  TranscriptTable,
} from "./types.js";

export type TranscriptStatus = "queued" | "running" | "succeeded" | "failed";
export type TranscriptChunkStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "timed_out";

export type CreateTranscriptInput = {
  contentId: string;
  generation: number;
  kind: "transcript";
  sourceAssetSnapshotId: string;
  status: TranscriptStatus;
};

export type TranscriptChunkUpsertInput = {
  body: string | null;
  chunkIndex: number;
  failureMessage: string | null;
  sourceEndMs: number;
  sourceStartMs: number;
  status: TranscriptChunkStatus;
  storageKey: string | null;
  transcriptId: string;
};

export type TranscriptListItem = {
  body: string | null;
  createdAt: Date;
  failedChunkCount: number;
  finishedAt: Date | null;
  generation: number;
  id: string;
  kind: "transcript" | "ocr" | "extracted-text";
  retryAvailable: boolean;
  sourceAsset: {
    assetId: string;
    assetSnapshotId: string;
    byteSize: number | null;
    kind: string;
    mimeType: string | null;
    primary: boolean;
    sourceUrl: string | null;
  };
  startedAt: Date | null;
  status: TranscriptStatus;
  totalChunkCount: number;
};

export type TranscriptChunkRecord = {
  body: string | null;
  chunkIndex: number;
  failureMessage: string | null;
  finishedAt: Date | null;
  id: string;
  sourceEndMs: number;
  sourceStartMs: number;
  startedAt: Date | null;
  status: TranscriptChunkStatus;
  storageKey: string | null;
  transcriptId: string;
};

export type TranscriptRecord = {
  body: string | null;
  contentId: string;
  finishedAt: Date | null;
  generation: number;
  id: string;
  kind: "transcript" | "ocr" | "extracted-text";
  sourceAssetSnapshotId: string;
  startedAt: Date | null;
  status: TranscriptStatus;
};

export type TranscriptSourceAssetRecord = {
  sourceAssetSnapshotId: string;
  sourceMimeType: string | null;
  sourceStorageKey: string | null;
  transcript: TranscriptRecord;
};

export type TranscriptRepositoryError = Error;

export class TranscriptRepository {
  public constructor(private readonly database: Kysely<GeshiDatabase>) {}

  public async createTranscript(
    input: CreateTranscriptInput,
  ): Promise<Result<TranscriptRecord, TranscriptRepositoryError>> {
    try {
      const transcript = await this.database
        .insertInto("transcripts")
        .values({
          body: null,
          content_id: input.contentId,
          generation: input.generation,
          id: crypto.randomUUID(),
          kind: input.kind,
          source_asset_snapshot_id: input.sourceAssetSnapshotId,
          started_at: input.status === "running" ? new Date() : null,
          status: input.status,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      return ok(toTranscriptRecord(transcript));
    } catch (error) {
      return err(toRepositoryError(error, "Failed to create transcript."));
    }
  }

  public async findTranscriptById(
    id: string,
  ): Promise<Result<TranscriptRecord | null, TranscriptRepositoryError>> {
    try {
      const transcript = await this.database
        .selectFrom("transcripts")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();

      return ok(
        transcript === undefined ? null : toTranscriptRecord(transcript),
      );
    } catch (error) {
      return err(toRepositoryError(error, "Failed to find transcript."));
    }
  }

  public async findLatestTranscriptGenerationByAssetSnapshotId(
    sourceAssetSnapshotId: string,
  ): Promise<Result<number, TranscriptRepositoryError>> {
    try {
      const transcript = await this.database
        .selectFrom("transcripts")
        .select(["generation"])
        .where("source_asset_snapshot_id", "=", sourceAssetSnapshotId)
        .orderBy("generation", "desc")
        .executeTakeFirst();

      return ok(transcript?.generation ?? 0);
    } catch (error) {
      return err(
        toRepositoryError(
          error,
          "Failed to find latest transcript generation.",
        ),
      );
    }
  }

  public async findQueuedOrRunningTranscriptByAssetSnapshotId(
    sourceAssetSnapshotId: string,
  ): Promise<Result<TranscriptRecord | null, TranscriptRepositoryError>> {
    try {
      const transcript = await this.database
        .selectFrom("transcripts")
        .selectAll()
        .where("source_asset_snapshot_id", "=", sourceAssetSnapshotId)
        .where("status", "in", ["queued", "running"])
        .orderBy("generation", "desc")
        .executeTakeFirst();

      return ok(
        transcript === undefined ? null : toTranscriptRecord(transcript),
      );
    } catch (error) {
      return err(
        toRepositoryError(
          error,
          "Failed to find active transcript by asset snapshot.",
        ),
      );
    }
  }

  public async listTranscriptsByContentId(
    contentId: string,
  ): Promise<Result<TranscriptListItem[], TranscriptRepositoryError>> {
    try {
      const transcripts = await this.database
        .selectFrom("transcripts")
        .innerJoin(
          "asset_snapshots",
          "asset_snapshots.id",
          "transcripts.source_asset_snapshot_id",
        )
        .innerJoin("assets", "assets.id", "asset_snapshots.asset_id")
        .leftJoin(
          this.database
            .selectFrom("transcript_chunks")
            .select([
              "transcript_id",
              sql<number>`count(*)`.as("total_chunk_count"),
              sql<number>`count(*) filter (where status in ('failed', 'timed_out'))`.as(
                "failed_chunk_count",
              ),
            ])
            .groupBy("transcript_id")
            .as("chunk_counts"),
          "chunk_counts.transcript_id",
          "transcripts.id",
        )
        .select([
          "asset_snapshots.byte_size",
          "asset_snapshots.id as asset_snapshot_id",
          "asset_snapshots.mime_type",
          "asset_snapshots.source_url",
          "assets.id as asset_id",
          "assets.is_primary",
          "assets.kind as asset_kind",
          "transcripts.body",
          "transcripts.created_at",
          "transcripts.finished_at",
          "transcripts.generation",
          "transcripts.id",
          "transcripts.kind",
          "transcripts.started_at",
          "transcripts.status",
          sql<number>`coalesce(chunk_counts.total_chunk_count, 0)`.as(
            "total_chunk_count",
          ),
          sql<number>`coalesce(chunk_counts.failed_chunk_count, 0)`.as(
            "failed_chunk_count",
          ),
        ])
        .where("transcripts.content_id", "=", contentId)
        .orderBy("transcripts.created_at", "desc")
        .execute();

      return ok(
        transcripts.map((transcript) => ({
          body: transcript.body,
          createdAt: transcript.created_at,
          failedChunkCount: transcript.failed_chunk_count,
          finishedAt: transcript.finished_at,
          generation: transcript.generation,
          id: transcript.id,
          kind: transcript.kind,
          retryAvailable:
            transcript.status === "failed" && transcript.failed_chunk_count > 0,
          sourceAsset: {
            assetId: transcript.asset_id,
            assetSnapshotId: transcript.asset_snapshot_id,
            byteSize: transcript.byte_size,
            kind: transcript.asset_kind,
            mimeType: transcript.mime_type,
            primary: transcript.is_primary,
            sourceUrl: transcript.source_url,
          },
          startedAt: transcript.started_at,
          status: transcript.status,
          totalChunkCount: transcript.total_chunk_count,
        })),
      );
    } catch (error) {
      return err(toRepositoryError(error, "Failed to list transcripts."));
    }
  }

  public async findTranscriptSourceAssetByTranscriptId(
    transcriptId: string,
  ): Promise<
    Result<TranscriptSourceAssetRecord | null, TranscriptRepositoryError>
  > {
    try {
      const row = await this.database
        .selectFrom("transcripts")
        .innerJoin(
          "asset_snapshots",
          "asset_snapshots.id",
          "transcripts.source_asset_snapshot_id",
        )
        .select([
          "asset_snapshots.id as source_asset_snapshot_id",
          "asset_snapshots.mime_type as source_mime_type",
          "asset_snapshots.storage_key as source_storage_key",
          "transcripts.body",
          "transcripts.content_id",
          "transcripts.finished_at",
          "transcripts.generation",
          "transcripts.id",
          "transcripts.kind",
          "transcripts.source_asset_snapshot_id",
          "transcripts.started_at",
          "transcripts.status",
        ])
        .where("transcripts.id", "=", transcriptId)
        .executeTakeFirst();

      if (row === undefined) {
        return ok(null);
      }

      return ok({
        sourceAssetSnapshotId: row.source_asset_snapshot_id,
        sourceMimeType: row.source_mime_type,
        sourceStorageKey: row.source_storage_key,
        transcript: {
          body: row.body,
          contentId: row.content_id,
          finishedAt: row.finished_at,
          generation: row.generation,
          id: row.id,
          kind: row.kind,
          sourceAssetSnapshotId: row.source_asset_snapshot_id,
          startedAt: row.started_at,
          status: row.status,
        },
      });
    } catch (error) {
      return err(
        toRepositoryError(error, "Failed to find transcript source asset."),
      );
    }
  }

  public async markTranscriptRunning(
    id: string,
  ): Promise<Result<void, TranscriptRepositoryError>> {
    return this.updateTranscriptStatus(id, "running", {
      body: undefined,
      finishedAt: null,
      startedAt: new Date(),
    });
  }

  public async markTranscriptFailed(
    id: string,
  ): Promise<Result<void, TranscriptRepositoryError>> {
    return this.updateTranscriptStatus(id, "failed", {
      finishedAt: new Date(),
    });
  }

  public async markTranscriptSucceeded(
    id: string,
    body: string,
  ): Promise<Result<void, TranscriptRepositoryError>> {
    return this.updateTranscriptStatus(id, "succeeded", {
      body,
      finishedAt: new Date(),
    });
  }

  public async upsertTranscriptChunk(
    input: TranscriptChunkUpsertInput,
  ): Promise<Result<TranscriptChunkRecord, TranscriptRepositoryError>> {
    try {
      const existingChunk = await this.database
        .selectFrom("transcript_chunks")
        .selectAll()
        .where("transcript_id", "=", input.transcriptId)
        .where("chunk_index", "=", input.chunkIndex)
        .executeTakeFirst();

      if (existingChunk === undefined) {
        const transcriptChunk = await this.database
          .insertInto("transcript_chunks")
          .values({
            body: input.body,
            chunk_index: input.chunkIndex,
            failure_message: input.failureMessage,
            id: crypto.randomUUID(),
            source_end_ms: input.sourceEndMs,
            source_start_ms: input.sourceStartMs,
            started_at: input.status === "running" ? new Date() : null,
            status: input.status,
            storage_key: input.storageKey,
            transcript_id: input.transcriptId,
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        return ok(toTranscriptChunkRecord(transcriptChunk));
      }

      const transcriptChunk = await this.database
        .updateTable("transcript_chunks")
        .set({
          body: input.body,
          failure_message: input.failureMessage,
          finished_at:
            input.status === "succeeded" ||
            input.status === "failed" ||
            input.status === "timed_out"
              ? new Date()
              : null,
          source_end_ms: input.sourceEndMs,
          source_start_ms: input.sourceStartMs,
          started_at: input.status === "running" ? new Date() : null,
          status: input.status,
          storage_key: input.storageKey,
        })
        .where("id", "=", existingChunk.id)
        .returningAll()
        .executeTakeFirstOrThrow();

      return ok(toTranscriptChunkRecord(transcriptChunk));
    } catch (error) {
      return err(
        toRepositoryError(error, "Failed to upsert transcript chunk."),
      );
    }
  }

  public async findTranscriptChunkById(
    id: string,
  ): Promise<Result<TranscriptChunkRecord | null, TranscriptRepositoryError>> {
    try {
      const transcriptChunk = await this.database
        .selectFrom("transcript_chunks")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();

      return ok(
        transcriptChunk === undefined
          ? null
          : toTranscriptChunkRecord(transcriptChunk),
      );
    } catch (error) {
      return err(toRepositoryError(error, "Failed to find transcript chunk."));
    }
  }

  public async listTranscriptChunksByTranscriptId(
    transcriptId: string,
  ): Promise<Result<TranscriptChunkRecord[], TranscriptRepositoryError>> {
    try {
      const transcriptChunks = await this.database
        .selectFrom("transcript_chunks")
        .selectAll()
        .where("transcript_id", "=", transcriptId)
        .orderBy("chunk_index", "asc")
        .execute();

      return ok(transcriptChunks.map(toTranscriptChunkRecord));
    } catch (error) {
      return err(
        toRepositoryError(
          error,
          "Failed to list transcript chunks by transcript.",
        ),
      );
    }
  }

  public async listRetryableTranscriptChunks(
    transcriptId: string,
  ): Promise<Result<TranscriptChunkRecord[], TranscriptRepositoryError>> {
    try {
      const transcriptChunks = await this.database
        .selectFrom("transcript_chunks")
        .selectAll()
        .where("transcript_id", "=", transcriptId)
        .where("status", "in", ["failed", "timed_out"])
        .orderBy("chunk_index", "asc")
        .execute();

      return ok(transcriptChunks.map(toTranscriptChunkRecord));
    } catch (error) {
      return err(
        toRepositoryError(error, "Failed to list retryable transcript chunks."),
      );
    }
  }

  public async markTranscriptChunkRunning(
    id: string,
  ): Promise<Result<void, TranscriptRepositoryError>> {
    return this.updateTranscriptChunkState(id, {
      body: undefined,
      failureMessage: null,
      finishedAt: null,
      startedAt: new Date(),
      status: "running",
      storageKey: undefined,
    });
  }

  public async markTranscriptChunkSucceeded(
    id: string,
    body: string,
  ): Promise<Result<void, TranscriptRepositoryError>> {
    return this.updateTranscriptChunkState(id, {
      body,
      failureMessage: null,
      finishedAt: new Date(),
      startedAt: undefined,
      status: "succeeded",
      storageKey: undefined,
    });
  }

  public async markTranscriptChunkFailed(
    id: string,
    failureMessage: string,
    status: "failed" | "timed_out" = "failed",
  ): Promise<Result<void, TranscriptRepositoryError>> {
    return this.updateTranscriptChunkState(id, {
      body: undefined,
      failureMessage,
      finishedAt: new Date(),
      startedAt: undefined,
      status,
      storageKey: undefined,
    });
  }

  private async updateTranscriptStatus(
    id: string,
    status: TranscriptStatus,
    updates: {
      body?: string | null | undefined;
      finishedAt?: Date | null;
      startedAt?: Date | null;
    },
  ): Promise<Result<void, TranscriptRepositoryError>> {
    try {
      await this.database
        .updateTable("transcripts")
        .set({
          body: updates.body,
          finished_at: updates.finishedAt,
          started_at: updates.startedAt,
          status,
        })
        .where("id", "=", id)
        .executeTakeFirstOrThrow();

      return ok(undefined);
    } catch (error) {
      return err(toRepositoryError(error, "Failed to update transcript."));
    }
  }

  private async updateTranscriptChunkState(
    id: string,
    updates: {
      body?: string | null | undefined;
      failureMessage?: string | null | undefined;
      finishedAt?: Date | null;
      startedAt?: Date | null | undefined;
      status: TranscriptChunkStatus;
      storageKey?: string | null | undefined;
    },
  ): Promise<Result<void, TranscriptRepositoryError>> {
    try {
      await this.database
        .updateTable("transcript_chunks")
        .set({
          body: updates.body,
          failure_message: updates.failureMessage,
          finished_at: updates.finishedAt,
          started_at: updates.startedAt,
          status: updates.status,
          storage_key: updates.storageKey,
        })
        .where("id", "=", id)
        .executeTakeFirstOrThrow();

      return ok(undefined);
    } catch (error) {
      return err(
        toRepositoryError(error, "Failed to update transcript chunk."),
      );
    }
  }
}

function toTranscriptRecord(
  transcript: Selectable<TranscriptTable>,
): TranscriptRecord {
  return {
    body: transcript.body,
    contentId: transcript.content_id,
    finishedAt: transcript.finished_at,
    generation: transcript.generation,
    id: transcript.id,
    kind: transcript.kind,
    sourceAssetSnapshotId: transcript.source_asset_snapshot_id,
    startedAt: transcript.started_at,
    status: transcript.status,
  };
}

function toTranscriptChunkRecord(
  transcriptChunk: Selectable<TranscriptChunkTable>,
): TranscriptChunkRecord {
  return {
    body: transcriptChunk.body,
    chunkIndex: transcriptChunk.chunk_index,
    failureMessage: transcriptChunk.failure_message,
    finishedAt: transcriptChunk.finished_at,
    id: transcriptChunk.id,
    sourceEndMs: transcriptChunk.source_end_ms,
    sourceStartMs: transcriptChunk.source_start_ms,
    startedAt: transcriptChunk.started_at,
    status: transcriptChunk.status,
    storageKey: transcriptChunk.storage_key,
    transcriptId: transcriptChunk.transcript_id,
  };
}

function toRepositoryError(error: unknown, fallbackMessage: string): Error {
  return error instanceof Error ? error : new Error(fallbackMessage);
}
