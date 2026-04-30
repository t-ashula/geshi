import type { Insertable, Kysely } from "kysely";
import { sql } from "kysely";

import { findLatestFingerprint } from "../lib/fingerprint.js";
import type { Result } from "../lib/result.js";
import { err, ok } from "../lib/result.js";
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
  sourceSlug: string;
  status: "discovered" | "stored" | "failed";
  summary: string | null;
  title: string | null;
};

export type ContentDetailItem = {
  collectedAt: Date;
  id: string;
  kind: string;
  publishedAt: Date | null;
  source: {
    id: string;
    slug: string;
    title: string | null;
  };
  status: "discovered" | "stored" | "failed";
  summary: string | null;
  title: string | null;
};

export type ContentRepositoryError = Error;

export class ContentRepository {
  public constructor(private readonly database: Kysely<GeshiDatabase>) {}

  public async createObservedContent(
    input: ImportObservedContentInput,
  ): Promise<Result<CreateObservedContentResult, ContentRepositoryError>> {
    try {
      return ok(
        await this.database.transaction().execute(async (transaction) => {
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
        }),
      );
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to create observed content."),
      );
    }
  }

  public async importObservedContents(
    inputs: ImportObservedContentInput[],
  ): Promise<Result<void, ContentRepositoryError>> {
    for (const input of inputs) {
      const result = await this.createObservedContent(input);

      if (!result.ok) {
        return result;
      }
    }

    return ok(undefined);
  }

  public async markContentStatus(
    contentId: string,
    status: "discovered" | "stored" | "failed",
  ): Promise<Result<void, ContentRepositoryError>> {
    try {
      await this.database
        .updateTable("contents")
        .set({
          status,
        })
        .where("id", "=", contentId)
        .executeTakeFirstOrThrow();

      return ok(undefined);
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to mark content status."),
      );
    }
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
    const latestContentSnapshots = latestContentSnapshotsQuery(this.database);
    const contents = await this.database
      .selectFrom("contents")
      .innerJoin("sources", "sources.id", "contents.source_id")
      .leftJoin(
        latestContentSnapshots.as("latest_content_snapshots"),
        "latest_content_snapshots.content_id",
        "contents.id",
      )
      .select([
        "contents.collected_at",
        "contents.created_at",
        "contents.id",
        "contents.kind",
        "contents.published_at",
        "contents.source_id",
        "contents.status",
        "latest_content_snapshots.summary",
        "latest_content_snapshots.title",
        "sources.slug as source_slug",
      ])
      .orderBy("contents.published_at", "desc")
      .orderBy("contents.created_at", "desc")
      .execute();

    return contents.map((content) => ({
      collectedAt: content.collected_at,
      id: content.id,
      kind: content.kind,
      publishedAt: content.published_at,
      sourceId: content.source_id,
      sourceSlug: content.source_slug,
      status: content.status,
      summary: content.summary,
      title: content.title,
    }));
  }

  public async findContentDetail(
    contentId: string,
  ): Promise<ContentDetailItem | null> {
    const content = await this.database
      .selectFrom("contents")
      .innerJoin("sources", "sources.id", "contents.source_id")
      .select([
        "contents.collected_at",
        "contents.id",
        "contents.kind",
        "contents.published_at",
        "contents.source_id",
        "contents.status",
        "sources.slug as source_slug",
      ])
      .where("contents.id", "=", contentId)
      .executeTakeFirst();

    if (content === undefined) {
      return null;
    }

    const contentSnapshot = await this.database
      .selectFrom("content_snapshots")
      .selectAll()
      .where("content_id", "=", contentId)
      .orderBy("version", "desc")
      .executeTakeFirst();
    const sourceSnapshot = await this.database
      .selectFrom("source_snapshots")
      .selectAll()
      .where("source_id", "=", content.source_id)
      .orderBy("version", "desc")
      .executeTakeFirst();

    return {
      collectedAt: content.collected_at,
      id: content.id,
      kind: content.kind,
      publishedAt: content.published_at,
      source: {
        id: content.source_id,
        slug: content.source_slug,
        title: sourceSnapshot?.title ?? null,
      },
      status: content.status,
      summary: contentSnapshot?.summary ?? null,
      title: contentSnapshot?.title ?? null,
    };
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

function latestContentSnapshotsQuery(database: Kysely<GeshiDatabase>) {
  return database
    .selectFrom("content_snapshots as content_snapshots")
    .innerJoin(
      database
        .selectFrom("content_snapshots")
        .select(["content_id", sql<number>`max(version)`.as("version")])
        .groupBy("content_id")
        .as("latest_content_snapshot_versions"),
      (join) =>
        join
          .onRef(
            "content_snapshots.content_id",
            "=",
            "latest_content_snapshot_versions.content_id",
          )
          .onRef(
            "content_snapshots.version",
            "=",
            "latest_content_snapshot_versions.version",
          ),
    )
    .select([
      "content_snapshots.content_id",
      "content_snapshots.summary",
      "content_snapshots.title",
    ]);
}
