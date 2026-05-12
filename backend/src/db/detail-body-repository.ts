import type { Kysely, Selectable } from "kysely";

import type { Result } from "../lib/result.js";
import { err, ok } from "../lib/result.js";
import type { DetailBodyTable, GeshiDatabase } from "./types.js";

export type DetailBodyRecord = {
  body: string;
  contentId: string;
  createdAt: Date;
  format: "html" | "markdown" | "plain";
  id: string;
  sourceAssetSnapshotId: string;
};

export type DetailBodyTarget = {
  assetId: string;
  assetKind: string;
  contentId: string;
  mimeType: string | null;
  pluginSlug: string;
  sourceAssetSnapshotId: string;
  sourceUrl: string | null;
  storageKey: string;
};

export type CreateDetailBodyInput = {
  body: string;
  contentId: string;
  format: "html" | "markdown" | "plain";
  sourceAssetSnapshotId: string;
};

export type DetailBodyRepositoryError = Error;

export class DetailBodyRepository {
  public constructor(private readonly database: Kysely<GeshiDatabase>) {}

  public async createDetailBody(
    input: CreateDetailBodyInput,
  ): Promise<Result<DetailBodyRecord, DetailBodyRepositoryError>> {
    try {
      const detailBody = await this.database
        .insertInto("detail_bodies")
        .values({
          body: input.body,
          content_id: input.contentId,
          format: input.format,
          id: crypto.randomUUID(),
          source_asset_snapshot_id: input.sourceAssetSnapshotId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      return ok(toDetailBodyRecord(detailBody));
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to create detail body."),
      );
    }
  }

  public async findDetailBodyByContentId(
    contentId: string,
  ): Promise<Result<DetailBodyRecord | null, DetailBodyRepositoryError>> {
    try {
      const detailBody = await this.database
        .selectFrom("detail_bodies")
        .selectAll()
        .where("content_id", "=", contentId)
        .orderBy("created_at", "desc")
        .executeTakeFirst();

      return ok(
        detailBody === undefined ? null : toDetailBodyRecord(detailBody),
      );
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to find detail body."),
      );
    }
  }

  public async findDetailBodyByAssetSnapshotId(
    sourceAssetSnapshotId: string,
  ): Promise<Result<DetailBodyRecord | null, DetailBodyRepositoryError>> {
    try {
      const detailBody = await this.database
        .selectFrom("detail_bodies")
        .selectAll()
        .where("source_asset_snapshot_id", "=", sourceAssetSnapshotId)
        .executeTakeFirst();

      return ok(
        detailBody === undefined ? null : toDetailBodyRecord(detailBody),
      );
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to find detail body by asset snapshot."),
      );
    }
  }

  public async findHtmlDetailBodyTargetByContentId(
    contentId: string,
  ): Promise<Result<DetailBodyTarget | null, DetailBodyRepositoryError>> {
    try {
      const latestAssetSnapshots = latestAssetSnapshotsQuery(this.database);
      const target = await this.database
        .selectFrom("contents")
        .innerJoin("sources", "sources.id", "contents.source_id")
        .innerJoin(
          "collector_settings",
          "collector_settings.source_id",
          "sources.id",
        )
        .innerJoin("assets", "assets.content_id", "contents.id")
        .innerJoin(
          latestAssetSnapshots.as("latest_asset_snapshots"),
          "latest_asset_snapshots.asset_id",
          "assets.id",
        )
        .select([
          "assets.id as asset_id",
          "assets.kind as asset_kind",
          "contents.id as content_id",
          "latest_asset_snapshots.asset_snapshot_id",
          "latest_asset_snapshots.mime_type",
          "latest_asset_snapshots.source_url",
          "latest_asset_snapshots.storage_key",
          "collector_settings.plugin_slug",
        ])
        .where("contents.id", "=", contentId)
        .where("assets.kind", "=", "html")
        .where("latest_asset_snapshots.storage_key", "is not", null)
        .where("latest_asset_snapshots.mime_type", "=", "text/html")
        .orderBy("assets.is_primary", "desc")
        .orderBy("assets.created_at", "asc")
        .executeTakeFirst();

      if (
        target === undefined ||
        target.storage_key === null ||
        target.mime_type === null
      ) {
        return ok(null);
      }

      return ok({
        assetId: target.asset_id,
        assetKind: target.asset_kind,
        contentId: target.content_id,
        mimeType: target.mime_type,
        pluginSlug: target.plugin_slug,
        sourceAssetSnapshotId: target.asset_snapshot_id,
        sourceUrl: target.source_url,
        storageKey: target.storage_key,
      });
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to find html detail body target."),
      );
    }
  }
}

function latestAssetSnapshotsQuery(database: Kysely<GeshiDatabase>) {
  return database
    .selectFrom("asset_snapshots as asset_snapshots")
    .innerJoin(
      database
        .selectFrom("asset_snapshots")
        .select(({ fn }) => [
          "asset_id",
          fn.max<number>("version").as("version"),
        ])
        .groupBy("asset_id")
        .as("latest_asset_snapshot_versions"),
      (join) =>
        join
          .onRef(
            "latest_asset_snapshot_versions.asset_id",
            "=",
            "asset_snapshots.asset_id",
          )
          .onRef(
            "latest_asset_snapshot_versions.version",
            "=",
            "asset_snapshots.version",
          ),
    )
    .select([
      "asset_snapshots.asset_id",
      "asset_snapshots.id as asset_snapshot_id",
      "asset_snapshots.mime_type",
      "asset_snapshots.source_url",
      "asset_snapshots.storage_key",
    ]);
}

function toDetailBodyRecord(
  detailBody: Selectable<DetailBodyTable>,
): DetailBodyRecord {
  return {
    body: detailBody.body,
    contentId: detailBody.content_id,
    createdAt: detailBody.created_at,
    format: detailBody.format,
    id: detailBody.id,
    sourceAssetSnapshotId: detailBody.source_asset_snapshot_id,
  };
}
