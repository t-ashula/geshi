import type { Insertable, Kysely, Selectable } from "kysely";
import { sql } from "kysely";

import { findLatestFingerprint } from "../lib/fingerprint.js";
import type { Result } from "../lib/result.js";
import { err, ok } from "../lib/result.js";
import type { AssetSnapshotTable, AssetTable, GeshiDatabase } from "./types.js";

export type UpsertStoredAssetInput = {
  acquiredFingerprints: string[];
  acquiredAt: Date;
  assetId: string;
  byteSize: number | null;
  checksum?: string | null;
  kind: string;
  mimeType: string | null;
  primary: boolean;
  sourceUrl: string | null;
  storageKey: string;
};

export type CreateObservedAssetInput = {
  contentFingerprintChanged: boolean;
  contentId: string;
  kind: string;
  observedFingerprints: string[];
  primary: boolean;
  sourceUrl: string | null;
};

export type AcquireTargetAsset = {
  acquiredFingerprint: string | null;
  id: string;
  kind: string;
  observedFingerprint: string;
  primary: boolean;
  sourceUrl: string | null;
};

export type ContentDetailAsset = {
  byteSize: number | null;
  id: string;
  kind: string;
  mimeType: string | null;
  primary: boolean;
  sourceUrl: string | null;
  storageKey: string | null;
};

export type TranscriptionTargetAsset = {
  assetId: string;
  assetSnapshotId: string;
  byteSize: number | null;
  kind: string;
  mimeType: string | null;
  primary: boolean;
  sourceUrl: string | null;
  storageKey: string | null;
};

export type StoredAssetMedia = {
  byteSize: number | null;
  id: string;
  mimeType: string;
  storageKey: string;
};

export type AssetListItem = {
  acquiredFingerprint: string | null;
  acquiredAt: Date | null;
  byteSize: number | null;
  checksum: string | null;
  contentId: string;
  createdAt: Date;
  id: string;
  kind: string;
  mimeType: string | null;
  observedFingerprint: string;
  primary: boolean;
  sourceUrl: string | null;
  storageKey: string | null;
};

export type CreateObservedAssetsResult = {
  assetIdsRequiringAcquire: string[];
};

export type AssetRepositoryError = Error;

export class AssetRepository {
  public constructor(private readonly database: Kysely<GeshiDatabase>) {}

  public async upsertStoredAsset(
    input: UpsertStoredAssetInput,
  ): Promise<Result<void, AssetRepositoryError>> {
    try {
      await this.database.transaction().execute(async (transaction) => {
        const asset = await transaction
          .selectFrom("assets")
          .selectAll()
          .where("id", "=", input.assetId)
          .executeTakeFirstOrThrow();
        const latestSnapshot = await findLatestAssetSnapshot(
          transaction,
          asset.id,
        );
        const latestAcquiredFingerprint = requireLatestFingerprint(
          input.acquiredFingerprints,
          "acquired asset fingerprint",
        );
        const snapshotChanged =
          asset.acquired_fingerprint !== latestAcquiredFingerprint ||
          asset.acquired_at?.getTime() !== input.acquiredAt.getTime() ||
          asset.is_primary !== input.primary ||
          latestSnapshot.byte_size !== input.byteSize ||
          latestSnapshot.checksum !== (input.checksum ?? null) ||
          latestSnapshot.mime_type !== input.mimeType ||
          latestSnapshot.source_url !== input.sourceUrl ||
          latestSnapshot.storage_key !== input.storageKey;

        await transaction
          .updateTable("assets")
          .set({
            acquired_at: input.acquiredAt,
            acquired_fingerprint: latestAcquiredFingerprint,
            is_primary: input.primary,
          })
          .where("id", "=", input.assetId)
          .executeTakeFirstOrThrow();

        if (snapshotChanged) {
          await transaction
            .insertInto("asset_snapshots")
            .values(
              toAssetSnapshotInsert(
                input.assetId,
                await findNextAssetSnapshotVersion(transaction, input.assetId),
                {
                  byteSize: input.byteSize,
                  checksum: input.checksum ?? null,
                  mimeType: input.mimeType,
                  sourceUrl: input.sourceUrl,
                  storageKey: input.storageKey,
                },
              ),
            )
            .executeTakeFirstOrThrow();
        }
      });

      return ok(undefined);
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to upsert stored asset."),
      );
    }
  }

  public async createObservedAssets(
    inputs: CreateObservedAssetInput[],
  ): Promise<Result<CreateObservedAssetsResult, AssetRepositoryError>> {
    const assetIdsRequiringAcquire: string[] = [];

    try {
      await this.database.transaction().execute(async (transaction) => {
        for (const input of inputs) {
          const latestObservedFingerprint = requireLatestFingerprint(
            input.observedFingerprints,
            "observed asset fingerprint",
          );
          const existingAsset = await transaction
            .selectFrom("assets")
            .selectAll()
            .where("content_id", "=", input.contentId)
            .where("observed_fingerprint", "in", input.observedFingerprints)
            .executeTakeFirst();

          if (existingAsset === undefined) {
            const createdAsset = await transaction
              .insertInto("assets")
              .values(toObservedAssetInsert(input, latestObservedFingerprint))
              .returningAll()
              .executeTakeFirstOrThrow();

            await transaction
              .insertInto("asset_snapshots")
              .values(
                toAssetSnapshotInsert(createdAsset.id, 1, {
                  byteSize: null,
                  checksum: null,
                  mimeType: null,
                  sourceUrl: input.sourceUrl,
                  storageKey: null,
                }),
              )
              .executeTakeFirstOrThrow();

            assetIdsRequiringAcquire.push(createdAsset.id);
            continue;
          }

          const latestSnapshot = await findLatestAssetSnapshot(
            transaction,
            existingAsset.id,
          );
          const observedFingerprintChanged =
            existingAsset.observed_fingerprint !== latestObservedFingerprint;
          const observedStateChanged =
            existingAsset.is_primary !== input.primary ||
            latestSnapshot.source_url !== input.sourceUrl;

          await transaction
            .updateTable("assets")
            .set({
              is_primary: input.primary,
            })
            .where("id", "=", existingAsset.id)
            .executeTakeFirstOrThrow();

          if (observedStateChanged) {
            await transaction
              .insertInto("asset_snapshots")
              .values(
                toAssetSnapshotInsert(
                  existingAsset.id,
                  await findNextAssetSnapshotVersion(
                    transaction,
                    existingAsset.id,
                  ),
                  {
                    byteSize: latestSnapshot.byte_size,
                    checksum: latestSnapshot.checksum,
                    mimeType: latestSnapshot.mime_type,
                    sourceUrl: input.sourceUrl,
                    storageKey: latestSnapshot.storage_key,
                  },
                ),
              )
              .executeTakeFirstOrThrow();
          }

          if (
            input.contentFingerprintChanged ||
            observedFingerprintChanged ||
            existingAsset.acquired_fingerprint === null
          ) {
            assetIdsRequiringAcquire.push(existingAsset.id);
          }
        }
      });

      return ok({
        assetIdsRequiringAcquire,
      });
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to create observed assets."),
      );
    }
  }

  public async listAssets(): Promise<
    Result<AssetListItem[], AssetRepositoryError>
  > {
    try {
      const latestAssetSnapshots = latestAssetSnapshotsQuery(this.database);
      const assets = await this.database
        .selectFrom("assets")
        .innerJoin(
          latestAssetSnapshots.as("latest_asset_snapshots"),
          "latest_asset_snapshots.asset_id",
          "assets.id",
        )
        .select([
          "assets.acquired_at",
          "assets.acquired_fingerprint",
          "assets.content_id",
          "assets.created_at",
          "assets.id",
          "assets.is_primary",
          "assets.kind",
          "assets.observed_fingerprint",
          "latest_asset_snapshots.byte_size",
          "latest_asset_snapshots.checksum",
          "latest_asset_snapshots.mime_type",
          "latest_asset_snapshots.source_url",
          "latest_asset_snapshots.storage_key",
        ])
        .orderBy("created_at", "asc")
        .execute();

      return ok(
        assets.map((asset) => ({
          acquiredAt: asset.acquired_at,
          acquiredFingerprint: asset.acquired_fingerprint,
          byteSize: asset.byte_size,
          checksum: asset.checksum,
          contentId: asset.content_id,
          createdAt: asset.created_at,
          id: asset.id,
          kind: asset.kind,
          mimeType: asset.mime_type,
          observedFingerprint: asset.observed_fingerprint,
          primary: asset.is_primary,
          sourceUrl: asset.source_url,
          storageKey: asset.storage_key,
        })),
      );
    } catch (error) {
      return err(
        error instanceof Error ? error : new Error("Failed to list assets."),
      );
    }
  }

  public async listPendingAssetsByContentId(
    contentId: string,
  ): Promise<Result<AcquireTargetAsset[], AssetRepositoryError>> {
    try {
      const latestAssetSnapshots = latestAssetSnapshotsQuery(this.database);
      const assets = await this.database
        .selectFrom("assets")
        .innerJoin(
          latestAssetSnapshots.as("latest_asset_snapshots"),
          "latest_asset_snapshots.asset_id",
          "assets.id",
        )
        .select([
          "assets.acquired_fingerprint",
          "assets.id",
          "assets.is_primary",
          "assets.kind",
          "assets.observed_fingerprint",
          "latest_asset_snapshots.source_url",
        ])
        .where("content_id", "=", contentId)
        .where("acquired_fingerprint", "is", null)
        .orderBy("created_at", "asc")
        .execute();

      return ok(
        assets.map((asset) => ({
          acquiredFingerprint: asset.acquired_fingerprint,
          id: asset.id,
          kind: asset.kind,
          observedFingerprint: asset.observed_fingerprint,
          primary: asset.is_primary,
          sourceUrl: asset.source_url,
        })),
      );
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to list pending assets by content."),
      );
    }
  }

  public async findAcquireTargetById(
    assetId: string,
  ): Promise<AcquireTargetAsset | null> {
    const asset = await this.database
      .selectFrom("assets")
      .selectAll()
      .where("id", "=", assetId)
      .executeTakeFirst();

    if (asset === undefined) {
      return null;
    }

    const latestSnapshot = await findLatestAssetSnapshot(
      this.database,
      asset.id,
    );

    return {
      acquiredFingerprint: asset.acquired_fingerprint,
      id: asset.id,
      kind: asset.kind,
      observedFingerprint: asset.observed_fingerprint,
      primary: asset.is_primary,
      sourceUrl: latestSnapshot.source_url,
    };
  }

  public async listAssetsByContentId(
    contentId: string,
  ): Promise<ContentDetailAsset[]> {
    const latestAssetSnapshots = latestAssetSnapshotsQuery(this.database);
    const assets = await this.database
      .selectFrom("assets")
      .innerJoin(
        latestAssetSnapshots.as("latest_asset_snapshots"),
        "latest_asset_snapshots.asset_id",
        "assets.id",
      )
      .select([
        "assets.id",
        "assets.is_primary",
        "assets.kind",
        "latest_asset_snapshots.asset_snapshot_id",
        "latest_asset_snapshots.byte_size",
        "latest_asset_snapshots.mime_type",
        "latest_asset_snapshots.source_url",
        "latest_asset_snapshots.storage_key",
      ])
      .where("content_id", "=", contentId)
      .orderBy("created_at", "asc")
      .execute();

    return assets.map((asset) => ({
      byteSize: asset.byte_size,
      id: asset.id,
      kind: asset.kind,
      mimeType: asset.mime_type,
      primary: asset.is_primary,
      sourceUrl: asset.source_url,
      storageKey: asset.storage_key,
    }));
  }

  public async listAudioTranscriptionTargetsByContentId(
    contentId: string,
  ): Promise<Result<TranscriptionTargetAsset[], AssetRepositoryError>> {
    try {
      const latestAssetSnapshots = latestAssetSnapshotsQuery(this.database);
      const assets = await this.database
        .selectFrom("assets")
        .innerJoin(
          latestAssetSnapshots.as("latest_asset_snapshots"),
          "latest_asset_snapshots.asset_id",
          "assets.id",
        )
        .select([
          "assets.id",
          "assets.is_primary",
          "assets.kind",
          "latest_asset_snapshots.asset_snapshot_id",
          "latest_asset_snapshots.byte_size",
          "latest_asset_snapshots.mime_type",
          "latest_asset_snapshots.source_url",
          "latest_asset_snapshots.storage_key",
        ])
        .where("content_id", "=", contentId)
        .where("kind", "=", "audio")
        .orderBy("created_at", "asc")
        .execute();

      return ok(
        assets.map((asset) => ({
          assetId: asset.id,
          assetSnapshotId: asset.asset_snapshot_id,
          byteSize: asset.byte_size,
          kind: asset.kind,
          mimeType: asset.mime_type,
          primary: asset.is_primary,
          sourceUrl: asset.source_url,
          storageKey: asset.storage_key,
        })),
      );
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to list transcription target assets."),
      );
    }
  }

  public async findStoredMediaById(
    assetId: string,
  ): Promise<StoredAssetMedia | null> {
    const asset = await this.database
      .selectFrom("assets")
      .select(["id"])
      .where("id", "=", assetId)
      .executeTakeFirst();

    if (asset === undefined) {
      return null;
    }

    const latestSnapshot = await findLatestAssetSnapshot(
      this.database,
      asset.id,
    );

    if (
      latestSnapshot.mime_type === null ||
      latestSnapshot.storage_key === null
    ) {
      return null;
    }

    return {
      byteSize: latestSnapshot.byte_size,
      id: asset.id,
      mimeType: latestSnapshot.mime_type,
      storageKey: latestSnapshot.storage_key,
    };
  }
}

function toObservedAssetInsert(
  input: CreateObservedAssetInput,
  observedFingerprint: string,
): Insertable<AssetTable> {
  return {
    content_id: input.contentId,
    id: crypto.randomUUID(),
    is_primary: input.primary,
    kind: input.kind,
    observed_fingerprint: observedFingerprint,
  };
}

function toAssetSnapshotInsert(
  assetId: string,
  version: number,
  snapshot: {
    byteSize: number | null;
    checksum: string | null;
    mimeType: string | null;
    sourceUrl: string | null;
    storageKey: string | null;
  },
): Insertable<AssetSnapshotTable> {
  return {
    asset_id: assetId,
    byte_size: snapshot.byteSize,
    checksum: snapshot.checksum,
    id: crypto.randomUUID(),
    mime_type: snapshot.mimeType,
    recorded_at: new Date(),
    source_url: snapshot.sourceUrl,
    storage_key: snapshot.storageKey,
    version,
  };
}

async function findNextAssetSnapshotVersion(
  database: Kysely<GeshiDatabase>,
  assetId: string,
): Promise<number> {
  const latestSnapshot = await database
    .selectFrom("asset_snapshots")
    .select(["version"])
    .where("asset_id", "=", assetId)
    .orderBy("version", "desc")
    .executeTakeFirst();

  return (latestSnapshot?.version ?? 0) + 1;
}

async function findLatestAssetSnapshot(
  database: Kysely<GeshiDatabase>,
  assetId: string,
): Promise<Selectable<AssetSnapshotTable>> {
  const latestSnapshot = await database
    .selectFrom("asset_snapshots")
    .selectAll()
    .where("asset_id", "=", assetId)
    .orderBy("version", "desc")
    .executeTakeFirst();

  if (latestSnapshot === undefined) {
    throw new Error(`Asset snapshot was not found for asset ${assetId}.`);
  }

  return latestSnapshot;
}

function requireLatestFingerprint(
  fingerprints: string[],
  label: string,
): string {
  const latestFingerprint = findLatestFingerprint(fingerprints);

  if (latestFingerprint === undefined) {
    throw new Error(`${label} is required.`);
  }

  return latestFingerprint;
}

function latestAssetSnapshotsQuery(database: Kysely<GeshiDatabase>) {
  return database
    .selectFrom("asset_snapshots as asset_snapshots")
    .innerJoin(
      database
        .selectFrom("asset_snapshots")
        .select(["asset_id", sql<number>`max(version)`.as("version")])
        .groupBy("asset_id")
        .as("latest_asset_snapshot_versions"),
      (join) =>
        join
          .onRef(
            "asset_snapshots.asset_id",
            "=",
            "latest_asset_snapshot_versions.asset_id",
          )
          .onRef(
            "asset_snapshots.version",
            "=",
            "latest_asset_snapshot_versions.version",
          ),
    )
    .select([
      "asset_snapshots.asset_id",
      "asset_snapshots.id as asset_snapshot_id",
      "asset_snapshots.byte_size",
      "asset_snapshots.checksum",
      "asset_snapshots.mime_type",
      "asset_snapshots.source_url",
      "asset_snapshots.storage_key",
    ]);
}
