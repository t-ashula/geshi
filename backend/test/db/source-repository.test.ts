import { v7 as uuidv7 } from "uuid";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  DuplicateSourceUrlHashError,
  SourceRepository,
} from "../../src/db/source-repository.js";
import { createTestDatabase, destroyTestDatabase } from "./test-database.js";

describe("SourceRepository", () => {
  let repository: SourceRepository;
  let testDatabase: Awaited<ReturnType<typeof createTestDatabase>> | undefined;

  beforeEach(async () => {
    testDatabase = await createTestDatabase();
    repository = new SourceRepository(testDatabase.database);
  });

  afterEach(async () => {
    if (testDatabase !== undefined) {
      await destroyTestDatabase(testDatabase);
    }
  });

  it("creates a source with its initial snapshot", async () => {
    const createdSource = await repository.createSource({
      description: "Weekly notes",
      id: uuidv7(),
      kind: "podcast",
      slug: "example-podcast",
      snapshotId: uuidv7(),
      title: "Example Podcast",
      url: "https://example.com/feed.xml",
      urlHash: "sha256:feed-1",
    });

    expect(createdSource.slug).toBe("example-podcast");
    expect(createdSource.title).toBe("Example Podcast");
    expect(createdSource.url).toBe("https://example.com/feed.xml");
    expect(createdSource.version).toBe(1);
  });

  it("lists sources with their latest snapshot", async () => {
    const sourceId = uuidv7();

    await repository.createSource({
      description: "First description",
      id: sourceId,
      kind: "podcast",
      slug: "latest-podcast",
      snapshotId: uuidv7(),
      title: "First title",
      url: "https://example.com/latest.xml",
      urlHash: "sha256:feed-2",
    });

    const currentTestDatabase = testDatabase;

    if (currentTestDatabase === undefined) {
      throw new Error("Test database was not initialized.");
    }

    await currentTestDatabase.pool.query(
      `
        insert into source_snapshots (
          id,
          source_id,
          version,
          title,
          description
        )
        values ($1, $2, $3, $4, $5)
      `,
      [uuidv7(), sourceId, 2, "Second title", "Second description"],
    );

    const sources = await repository.listSources();

    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatchObject({
      description: "Second description",
      slug: "latest-podcast",
      title: "Second title",
      version: 2,
    });
  });

  it("rejects duplicate url hashes", async () => {
    await repository.createSource({
      id: uuidv7(),
      kind: "podcast",
      slug: "duplicate-one",
      snapshotId: uuidv7(),
      url: "https://example.com/duplicate-one.xml",
      urlHash: "sha256:feed-duplicate",
    });

    await expect(
      repository.createSource({
        id: uuidv7(),
        kind: "podcast",
        slug: "duplicate-two",
        snapshotId: uuidv7(),
        url: "https://example.com/duplicate-two.xml",
        urlHash: "sha256:feed-duplicate",
      }),
    ).rejects.toThrow(DuplicateSourceUrlHashError);
  });
});
