import type { Insertable, Kysely, Selectable } from "kysely";

import { findLatestFingerprint } from "../lib/fingerprint.js";
import type {
  ContentSnapshotTable,
  ContentTable,
  GeshiDatabase,
} from "./types.js";

export type ImportObservedContentInput = {
  contentFingerprints: string[];
  externalId: string;
  kind: string;
  publishedAt: Date | null;
  sourceId: string;
  status: "discovered" | "stored" | "failed";
  summary: string | null;
  title: string | null;
};

export type CreateObservedContentResult = {
  fingerprintChanged: boolean;
  id: string;
};

export type AcquireTargetContent = {
  externalId: string;
  id: string;
  kind: string;
  publishedAt: Date | null;
  sourceSlug: string;
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

  public async createObservedContent(
    input: ImportObservedContentInput,
  ): Promise<CreateObservedContentResult> {
    return this.database.transaction().execute(async (transaction) => {
      const latestFingerprint = findLatestFingerprint(
        input.contentFingerprints,
      );

      if (latestFingerprint === undefined) {
        throw new Error("content fingerprint is required.");
      }
      const insertedContent = await transaction
        .selectFrom("contents")
        .selectAll()
        .where("source_id", "=", input.sourceId)
        .where("content_fingerprint", "in", input.contentFingerprints)
        .executeTakeFirst();

      if (insertedContent === undefined) {
        const createdContent = await transaction
          .insertInto("contents")
          .values(toContentInsert(input, latestFingerprint))
          .returningAll()
          .executeTakeFirstOrThrow();

        await transaction
          .insertInto("content_snapshots")
          .values(toContentSnapshotInsert(createdContent.id, 1, input))
          .executeTakeFirstOrThrow();

        return {
          fingerprintChanged: false,
          id: createdContent.id,
        };
      }

      const latestSnapshot = await transaction
        .selectFrom("content_snapshots")
        .selectAll()
        .where("content_id", "=", insertedContent.id)
        .orderBy("version", "desc")
        .executeTakeFirst();

      const fingerprintChanged =
        insertedContent.content_fingerprint !== latestFingerprint;
      const snapshotChanged =
        latestSnapshot?.title !== input.title ||
        latestSnapshot?.summary !== input.summary;

      await transaction
        .updateTable("contents")
        .set({
          collected_at: new Date(),
          content_fingerprint: latestFingerprint,
          external_id: input.externalId,
          kind: input.kind,
          published_at: input.publishedAt,
          status: input.status,
        })
        .where("id", "=", insertedContent.id)
        .executeTakeFirstOrThrow();

      if (snapshotChanged) {
        await transaction
          .insertInto("content_snapshots")
          .values(
            toContentSnapshotInsert(
              insertedContent.id,
              (latestSnapshot?.version ?? 0) + 1,
              input,
            ),
          )
          .executeTakeFirstOrThrow();
      }

      return {
        fingerprintChanged,
        id: insertedContent.id,
      };
    });
  }

  public async importObservedContents(
    inputs: ImportObservedContentInput[],
  ): Promise<void> {
    for (const input of inputs) {
      await this.createObservedContent(input);
    }
  }

  public async markContentStatus(
    contentId: string,
    status: "discovered" | "stored" | "failed",
  ): Promise<void> {
    await this.database
      .updateTable("contents")
      .set({
        status,
      })
      .where("id", "=", contentId)
      .executeTakeFirstOrThrow();
  }

  public async findContentAcquireTarget(
    contentId: string,
  ): Promise<AcquireTargetContent | null> {
    const content = await this.database
      .selectFrom("contents")
      .innerJoin("sources", "sources.id", "contents.source_id")
      .select([
        "contents.external_id",
        "contents.id",
        "contents.kind",
        "contents.published_at",
        "contents.status",
        "sources.slug as source_slug",
      ])
      .where("contents.id", "=", contentId)
      .executeTakeFirst();

    if (content === undefined) {
      return null;
    }

    const snapshot = await this.database
      .selectFrom("content_snapshots")
      .selectAll()
      .where("content_id", "=", contentId)
      .orderBy("version", "desc")
      .executeTakeFirst();

    return {
      externalId: content.external_id,
      id: content.id,
      kind: content.kind,
      publishedAt: content.published_at,
      sourceSlug: content.source_slug,
      status: content.status,
      summary: snapshot?.summary ?? null,
      title: snapshot?.title ?? null,
    };
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
      .orderBy("content_id", "asc")
      .orderBy("version", "desc")
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
  contentFingerprint: string,
): Insertable<ContentTable> {
  return {
    content_fingerprint: contentFingerprint,
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
