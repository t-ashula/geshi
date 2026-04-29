import { v7 as uuidv7 } from "uuid";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AssetRepository } from "../../src/db/asset-repository.js";
import { createTestDatabase, destroyTestDatabase } from "./test-database.js";

describe("AssetRepository", () => {
  let repository: AssetRepository;
  let testDatabase: Awaited<ReturnType<typeof createTestDatabase>> | undefined;

  beforeEach(async () => {
    testDatabase = await createTestDatabase();
    repository = new AssetRepository(testDatabase.database);
  });

  afterEach(async () => {
    if (testDatabase !== undefined) {
      await destroyTestDatabase(testDatabase);
    }
  });

  it("does not rewrite observed fingerprint when an existing asset matches an older fingerprint", async () => {
    const currentTestDatabase = testDatabase;

    if (currentTestDatabase === undefined) {
      throw new Error("Test database was not initialized.");
    }

    const sourceId = uuidv7();
    const contentId = uuidv7();
    await currentTestDatabase.pool.query(
      `
        insert into sources (
          id,
          slug,
          kind,
          url,
          url_hash
        )
        values ($1, $2, $3, $4, $5)
      `,
      [
        sourceId,
        "asset-repository-test-source",
        "podcast",
        "https://example.com/feed.xml",
        "sha256:asset-repository-test-source",
      ],
    );
    await currentTestDatabase.pool.query(
      `
        insert into contents (
          id,
          source_id,
          external_id,
          content_fingerprint,
          kind,
          status
        )
        values ($1, $2, $3, $4, $5, $6)
      `,
      [
        contentId,
        sourceId,
        "episode-1",
        "2026-04-28:content-1",
        "podcast-episode",
        "discovered",
      ],
    );
    const assetId = uuidv7();
    await currentTestDatabase.pool.query(
      `
        insert into assets (
          id,
          content_id,
          kind,
          is_primary,
          observed_fingerprint
        )
        values ($1, $2, $3, $4, $5)
      `,
      [assetId, contentId, "audio", false, "2026-04-28:audio:old"],
    );
    await currentTestDatabase.pool.query(
      `
        insert into asset_snapshots (
          id,
          asset_id,
          version,
          source_url
        )
        values ($1, $2, $3, $4)
      `,
      [uuidv7(), assetId, 1, "https://cdn.example.com/audio-old.mp3"],
    );

    const existingAsset = (await repository.listAssets())[0];

    if (existingAsset === undefined) {
      throw new Error("Expected an existing asset.");
    }

    const result = await repository.createObservedAssets([
      {
        contentFingerprintChanged: false,
        contentId: existingAsset.contentId,
        kind: "audio",
        observedFingerprints: ["2026-04-29:audio:new", "2026-04-28:audio:old"],
        primary: true,
        sourceUrl: "https://cdn.example.com/audio-new.mp3",
      },
    ]);

    const assets = await repository.listAssets();
    const storedAsset = assets.find((asset) => asset.id === existingAsset.id);

    expect(result.assetIdsRequiringAcquire).toEqual([existingAsset.id]);
    expect(storedAsset).toMatchObject({
      id: existingAsset.id,
      observedFingerprint: "2026-04-28:audio:old",
      primary: true,
      sourceUrl: "https://cdn.example.com/audio-new.mp3",
    });
  });
});
