import type { Insertable, Kysely } from "kysely";

import { findLatestFingerprint } from "../lib/fingerprint.js";
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

export class AssetRepository {
  public constructor(private readonly database: Kysely<GeshiDatabase>) {}

  public async upsertStoredAsset(input: UpsertStoredAssetInput): Promise<void> {
    await this.database.transaction().execute(async (transaction) => {
      const asset = await transaction
        .selectFrom("assets")
        .selectAll()
        .where("id", "=", input.assetId)
        .executeTakeFirstOrThrow();
      const latestAcquiredFingerprint = requireLatestFingerprint(
        input.acquiredFingerprints,
        "acquired asset fingerprint",
      );
      const snapshotChanged =
        asset.acquired_fingerprint !== latestAcquiredFingerprint ||
        asset.acquired_at?.getTime() !== input.acquiredAt.getTime() ||
        asset.byte_size !== input.byteSize ||
        asset.checksum !== (input.checksum ?? null) ||
        asset.is_primary !== input.primary ||
        asset.mime_type !== input.mimeType ||
        asset.source_url !== input.sourceUrl ||
        asset.storage_key !== input.storageKey;

      await transaction
        .updateTable("assets")
        .set({
          acquired_at: input.acquiredAt,
          acquired_fingerprint: latestAcquiredFingerprint,
          byte_size: input.byteSize,
          checksum: input.checksum ?? null,
          is_primary: input.primary,
          mime_type: input.mimeType,
          source_url: input.sourceUrl,
          storage_key: input.storageKey,
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
                acquiredFingerprint: latestAcquiredFingerprint,
                byteSize: input.byteSize,
                checksum: input.checksum ?? null,
                mimeType: input.mimeType,
                observedFingerprint: asset.observed_fingerprint,
                sourceUrl: input.sourceUrl,
                storageKey: input.storageKey,
              },
            ),
          )
          .executeTakeFirstOrThrow();
      }
    });
  }

  public async createObservedAssets(
    inputs: CreateObservedAssetInput[],
  ): Promise<CreateObservedAssetsResult> {
    const assetIdsRequiringAcquire: string[] = [];

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
                acquiredFingerprint: null,
                byteSize: null,
                checksum: null,
                mimeType: null,
                observedFingerprint: latestObservedFingerprint,
                sourceUrl: input.sourceUrl,
                storageKey: null,
              }),
            )
            .executeTakeFirstOrThrow();

          assetIdsRequiringAcquire.push(createdAsset.id);
          continue;
        }

        const observedFingerprintChanged =
          existingAsset.observed_fingerprint !== latestObservedFingerprint;
        const observedStateChanged =
          observedFingerprintChanged ||
          existingAsset.is_primary !== input.primary ||
          existingAsset.source_url !== input.sourceUrl;

        await transaction
          .updateTable("assets")
          .set({
            is_primary: input.primary,
            observed_fingerprint: latestObservedFingerprint,
            source_url: input.sourceUrl,
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
                  acquiredFingerprint: existingAsset.acquired_fingerprint,
                  byteSize: existingAsset.byte_size,
                  checksum: existingAsset.checksum,
                  mimeType: existingAsset.mime_type,
                  observedFingerprint: latestObservedFingerprint,
                  sourceUrl: input.sourceUrl,
                  storageKey: existingAsset.storage_key,
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

    return {
      assetIdsRequiringAcquire,
    };
  }

  public async listAssets(): Promise<AssetListItem[]> {
    const assets = await this.database
      .selectFrom("assets")
      .selectAll()
      .orderBy("created_at", "asc")
      .execute();

    return assets.map((asset) => ({
      acquiredFingerprint: asset.acquired_fingerprint,
      byteSize: asset.byte_size,
      checksum: asset.checksum,
      contentId: asset.content_id,
      createdAt: asset.created_at,
      acquiredAt: asset.acquired_at,
      id: asset.id,
      kind: asset.kind,
      mimeType: asset.mime_type,
      observedFingerprint: asset.observed_fingerprint,
      primary: asset.is_primary,
      sourceUrl: asset.source_url,
      storageKey: asset.storage_key,
    }));
  }

  public async listPendingAssetsByContentId(
    contentId: string,
  ): Promise<AcquireTargetAsset[]> {
    const assets = await this.database
      .selectFrom("assets")
      .selectAll()
      .where("content_id", "=", contentId)
      .where("acquired_fingerprint", "is", null)
      .orderBy("created_at", "asc")
      .execute();

    return assets.map((asset) => ({
      acquiredFingerprint: asset.acquired_fingerprint,
      id: asset.id,
      kind: asset.kind,
      observedFingerprint: asset.observed_fingerprint,
      primary: asset.is_primary,
      sourceUrl: asset.source_url,
    }));
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

    return {
      acquiredFingerprint: asset.acquired_fingerprint,
      id: asset.id,
      kind: asset.kind,
      observedFingerprint: asset.observed_fingerprint,
      primary: asset.is_primary,
      sourceUrl: asset.source_url,
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
    source_url: input.sourceUrl,
  };
}

function toAssetSnapshotInsert(
  assetId: string,
  version: number,
  snapshot: {
    acquiredFingerprint: string | null;
    byteSize: number | null;
    checksum: string | null;
    mimeType: string | null;
    observedFingerprint: string;
    sourceUrl: string | null;
    storageKey: string | null;
  },
): Insertable<AssetSnapshotTable> {
  return {
    acquired_fingerprint: snapshot.acquiredFingerprint,
    asset_id: assetId,
    byte_size: snapshot.byteSize,
    checksum: snapshot.checksum,
    id: crypto.randomUUID(),
    mime_type: snapshot.mimeType,
    observed_fingerprint: snapshot.observedFingerprint,
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
