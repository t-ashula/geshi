import type { Insertable, Kysely, Selectable } from "kysely";

import type {
  ContentSnapshotTable,
  ContentTable,
  GeshiDatabase,
} from "./types.js";

export type ImportObservedContentInput = {
  externalId: string;
  kind: string;
  publishedAt: Date | null;
  sourceId: string;
  status: "discovered" | "stored" | "failed";
  summary: string | null;
  title: string | null;
};

export type ContentListItem = {
  collectedAt: Date;
  id: string;
  kind: string;
  publishedAt: Date | null;
  sourceId: string;
  status: "discovered" | "stored" | "failed";
  summary: string | null;
  title: string | null;
};

export class ContentRepository {
  public constructor(private readonly database: Kysely<GeshiDatabase>) {}

  public async importObservedContents(
    inputs: ImportObservedContentInput[],
  ): Promise<void> {
    await this.database.transaction().execute(async (transaction) => {
      for (const input of inputs) {
        const existingContent = await transaction
          .selectFrom("contents")
          .selectAll()
          .where("source_id", "=", input.sourceId)
          .where("external_id", "=", input.externalId)
          .executeTakeFirst();

        if (existingContent === undefined) {
          const insertedContent = await transaction
            .insertInto("contents")
            .values(toContentInsert(input))
            .returningAll()
            .executeTakeFirstOrThrow();

          await transaction
            .insertInto("content_snapshots")
            .values(toContentSnapshotInsert(insertedContent.id, 1, input))
            .executeTakeFirstOrThrow();

          continue;
        }

        await transaction
          .updateTable("contents")
          .set({
            collected_at: new Date(),
            kind: input.kind,
            published_at: input.publishedAt,
            status: input.status,
          })
          .where("id", "=", existingContent.id)
          .executeTakeFirstOrThrow();

        const latestSnapshot = await transaction
          .selectFrom("content_snapshots")
          .selectAll()
          .where("content_id", "=", existingContent.id)
          .orderBy("version desc")
          .executeTakeFirst();

        const nextVersion = (latestSnapshot?.version ?? 0) + 1;

        await transaction
          .insertInto("content_snapshots")
          .values(
            toContentSnapshotInsert(existingContent.id, nextVersion, input),
          )
          .executeTakeFirstOrThrow();
      }
    });
  }

  public async listContents(): Promise<ContentListItem[]> {
    const contents = await this.database
      .selectFrom("contents")
      .selectAll()
      .orderBy("published_at", "desc")
      .orderBy("created_at", "desc")
      .execute();
    const snapshots = await this.database
      .selectFrom("content_snapshots")
      .selectAll()
      .orderBy("content_id asc")
      .orderBy("version desc")
      .execute();

    const latestSnapshotByContentId = new Map<
      string,
      Selectable<ContentSnapshotTable>
    >();

    for (const snapshot of snapshots) {
      if (!latestSnapshotByContentId.has(snapshot.content_id)) {
        latestSnapshotByContentId.set(snapshot.content_id, snapshot);
      }
    }

    return contents.map((content) => {
      const snapshot = latestSnapshotByContentId.get(content.id) ?? null;

      return {
        collectedAt: content.collected_at,
        id: content.id,
        kind: content.kind,
        publishedAt: content.published_at,
        sourceId: content.source_id,
        status: content.status,
        summary: snapshot?.summary ?? null,
        title: snapshot?.title ?? null,
      };
    });
  }
}

function toContentInsert(
  input: ImportObservedContentInput,
): Insertable<ContentTable> {
  return {
    external_id: input.externalId,
    id: crypto.randomUUID(),
    kind: input.kind,
    published_at: input.publishedAt,
    source_id: input.sourceId,
    status: input.status,
  };
}

function toContentSnapshotInsert(
  contentId: string,
  version: number,
  input: ImportObservedContentInput,
): Insertable<ContentSnapshotTable> {
  return {
    content_id: contentId,
    id: crypto.randomUUID(),
    recorded_at: new Date(),
    summary: input.summary,
    title: input.title,
    version,
  };
}
