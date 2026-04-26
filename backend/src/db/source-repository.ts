import type { Insertable, Kysely, Selectable } from "kysely";

import type {
  CollectorSettingSnapshotTable,
  CollectorSettingTable,
  GeshiDatabase,
  SourceSnapshotTable,
  SourceTable,
} from "./types.js";

export type CreateSourceInput = {
  collectorSettingId: string;
  collectorSettingSnapshotId: string;
  description?: string | null;
  id: string;
  kind: "podcast";
  pluginSlug: string;
  slug: string;
  snapshotId: string;
  title?: string | null;
  url: string;
  urlHash: string;
};

export type ObserveSourceTarget = {
  collectorSettingId: string;
  collectorSettingSnapshotId: string;
  config: Record<string, unknown>;
  pluginSlug: string;
  slug: string;
  sourceId: string;
  sourceKind: "podcast";
  url: string;
};

export type SourceListItem = {
  createdAt: Date;
  description: string | null;
  id: string;
  kind: "podcast";
  recordedAt: Date | null;
  slug: string;
  title: string | null;
  url: string;
  urlHash: string;
  version: number | null;
};

export class DuplicateSourceUrlHashError extends Error {
  public constructor(urlHash: string) {
    super(`A source already exists for url hash: ${urlHash}`);
    this.name = "DuplicateSourceUrlHashError";
  }
}

export class SourceRepository {
  public constructor(private readonly database: Kysely<GeshiDatabase>) {}

  public async createSource(input: CreateSourceInput): Promise<SourceListItem> {
    try {
      return await this.database.transaction().execute(async (transaction) => {
        await transaction
          .insertInto("sources")
          .values(toSourceInsert(input))
          .executeTakeFirstOrThrow();

        await transaction
          .insertInto("source_snapshots")
          .values(toSourceSnapshotInsert(input))
          .executeTakeFirstOrThrow();

        await transaction
          .insertInto("collector_settings")
          .values(toCollectorSettingInsert(input))
          .executeTakeFirstOrThrow();

        await transaction
          .insertInto("collector_setting_snapshots")
          .values(toCollectorSettingSnapshotInsert(input))
          .executeTakeFirstOrThrow();

        const source = await transaction
          .selectFrom("sources")
          .selectAll()
          .where("id", "=", input.id)
          .executeTakeFirstOrThrow();
        const snapshot = await transaction
          .selectFrom("source_snapshots")
          .selectAll()
          .where("source_id", "=", input.id)
          .where("version", "=", 1)
          .executeTakeFirstOrThrow();

        return toSourceListItem(source, snapshot);
      });
    } catch (error) {
      if (isDuplicateSourceUrlHashError(error)) {
        throw new DuplicateSourceUrlHashError(input.urlHash);
      }

      throw error;
    }
  }

  public async listSources(): Promise<SourceListItem[]> {
    const sources = await this.database
      .selectFrom("sources")
      .selectAll()
      .orderBy("created_at desc")
      .execute();
    const snapshots = await this.database
      .selectFrom("source_snapshots")
      .selectAll()
      .orderBy("source_id asc")
      .orderBy("version desc")
      .execute();

    const latestSnapshotBySourceId = new Map<
      string,
      Selectable<SourceSnapshotTable>
    >();

    for (const snapshot of snapshots) {
      if (!latestSnapshotBySourceId.has(snapshot.source_id)) {
        latestSnapshotBySourceId.set(snapshot.source_id, snapshot);
      }
    }

    return sources.map((source) =>
      toSourceListItem(source, latestSnapshotBySourceId.get(source.id) ?? null),
    );
  }

  public async findObserveSourceTarget(
    sourceId: string,
  ): Promise<ObserveSourceTarget | null> {
    const source = await this.database
      .selectFrom("sources")
      .selectAll()
      .where("id", "=", sourceId)
      .executeTakeFirst();

    if (source === undefined) {
      return null;
    }

    const collectorSetting = await this.database
      .selectFrom("collector_settings")
      .selectAll()
      .where("source_id", "=", sourceId)
      .orderBy("created_at asc")
      .executeTakeFirst();

    if (collectorSetting === undefined) {
      return null;
    }

    const collectorSettingSnapshot = await this.database
      .selectFrom("collector_setting_snapshots")
      .selectAll()
      .where("collector_setting_id", "=", collectorSetting.id)
      .orderBy("version desc")
      .executeTakeFirst();

    if (
      collectorSettingSnapshot === undefined ||
      !collectorSettingSnapshot.enabled
    ) {
      return null;
    }

    return toObserveSourceTarget(
      source,
      collectorSetting,
      collectorSettingSnapshot,
    );
  }
}

function isDuplicateSourceUrlHashError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const constraint = "sources_url_hash_key";
  const errorWithCode = error as Error & {
    code?: string;
    constraint?: string;
    detail?: string;
  };

  return (
    errorWithCode.code === "23505" ||
    errorWithCode.constraint === constraint ||
    error.message.includes(constraint) ||
    errorWithCode.detail?.includes(constraint) === true
  );
}

function toSourceInsert(input: CreateSourceInput): Insertable<SourceTable> {
  return {
    id: input.id,
    kind: input.kind,
    slug: input.slug,
    url: input.url,
    url_hash: input.urlHash,
  };
}

function toSourceSnapshotInsert(
  input: CreateSourceInput,
): Insertable<SourceSnapshotTable> {
  return {
    description: input.description ?? null,
    id: input.snapshotId,
    recorded_at: new Date(),
    source_id: input.id,
    title: input.title ?? null,
    version: 1,
  };
}

function toCollectorSettingInsert(
  input: CreateSourceInput,
): Insertable<CollectorSettingTable> {
  return {
    id: input.collectorSettingId,
    plugin_slug: input.pluginSlug,
    source_id: input.id,
  };
}

function toCollectorSettingSnapshotInsert(
  input: CreateSourceInput,
): Insertable<CollectorSettingSnapshotTable> {
  return {
    collector_setting_id: input.collectorSettingId,
    config: {},
    enabled: true,
    id: input.collectorSettingSnapshotId,
    recorded_at: new Date(),
    version: 1,
  };
}

function toSourceListItem(
  source: Selectable<SourceTable>,
  snapshot: Selectable<SourceSnapshotTable> | null,
): SourceListItem {
  return {
    createdAt: source.created_at,
    description: snapshot?.description ?? null,
    id: source.id,
    kind: source.kind,
    recordedAt: snapshot?.recorded_at ?? null,
    slug: source.slug,
    title: snapshot?.title ?? null,
    url: source.url,
    urlHash: source.url_hash,
    version: snapshot?.version ?? null,
  };
}

function toObserveSourceTarget(
  source: Selectable<SourceTable>,
  collectorSetting: Selectable<CollectorSettingTable>,
  collectorSettingSnapshot: Selectable<CollectorSettingSnapshotTable>,
): ObserveSourceTarget {
  return {
    collectorSettingId: collectorSetting.id,
    collectorSettingSnapshotId: collectorSettingSnapshot.id,
    config: collectorSettingSnapshot.config,
    pluginSlug: collectorSetting.plugin_slug,
    slug: source.slug,
    sourceId: source.id,
    sourceKind: source.kind,
    url: source.url,
  };
}
