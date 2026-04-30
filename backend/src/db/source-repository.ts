import type { Insertable, Kysely, Selectable } from "kysely";

import type { SourcePeriodicCrawlSettings } from "../service/periodic-crawl-settings.js";
import { defaultSourcePeriodicCrawlSettings } from "../service/periodic-crawl-settings.js";
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
  crawlEnabled: boolean;
  crawlIntervalMinutes: number;
  pluginSlug: string;
  slug: string;
  sourceId: string;
  sourceKind: "podcast";
  url: string;
};

export type SourceListItem = {
  collectorSettingsVersion: number | null;
  periodicCrawlEnabled: boolean;
  periodicCrawlIntervalMinutes: number;
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

export type PeriodicCrawlSourceTarget = ObserveSourceTarget;

export class DuplicateSourceUrlHashError extends Error {
  public constructor(urlHash: string) {
    super(`A source already exists for url hash: ${urlHash}`);
    this.name = "DuplicateSourceUrlHashError";
  }
}

export class CollectorSettingsVersionConflictError extends Error {
  public constructor() {
    super("Collector settings were updated by another request.");
    this.name = "CollectorSettingsVersionConflictError";
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
        const collectorSettingSnapshot = await transaction
          .selectFrom("collector_setting_snapshots")
          .selectAll()
          .where("collector_setting_id", "=", input.collectorSettingId)
          .where("version", "=", 1)
          .executeTakeFirstOrThrow();

        return toSourceListItem(source, snapshot, collectorSettingSnapshot);
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
      .orderBy("created_at", "desc")
      .execute();
    const snapshots = await this.database
      .selectFrom("source_snapshots")
      .selectAll()
      .orderBy("source_id", "asc")
      .orderBy("version", "desc")
      .execute();

    const latestSnapshotBySourceId = new Map<
      string,
      Selectable<SourceSnapshotTable>
    >();
    const collectorSettings = await this.database
      .selectFrom("collector_settings")
      .selectAll()
      .orderBy("created_at", "asc")
      .execute();
    const collectorSettingBySourceId = new Map<
      string,
      Selectable<CollectorSettingTable>
    >();
    for (const collectorSetting of collectorSettings) {
      if (!collectorSettingBySourceId.has(collectorSetting.source_id)) {
        collectorSettingBySourceId.set(
          collectorSetting.source_id,
          collectorSetting,
        );
      }
    }
    const collectorSnapshots = await this.database
      .selectFrom("collector_setting_snapshots")
      .selectAll()
      .orderBy("collector_setting_id", "asc")
      .orderBy("version", "desc")
      .execute();
    const latestCollectorSnapshotBySettingId = new Map<
      string,
      Selectable<CollectorSettingSnapshotTable>
    >();

    for (const snapshot of snapshots) {
      if (!latestSnapshotBySourceId.has(snapshot.source_id)) {
        latestSnapshotBySourceId.set(snapshot.source_id, snapshot);
      }
    }

    for (const snapshot of collectorSnapshots) {
      if (
        !latestCollectorSnapshotBySettingId.has(snapshot.collector_setting_id)
      ) {
        latestCollectorSnapshotBySettingId.set(
          snapshot.collector_setting_id,
          snapshot,
        );
      }
    }

    return sources.map((source) =>
      toSourceListItem(
        source,
        latestSnapshotBySourceId.get(source.id) ?? null,
        latestCollectorSnapshotBySettingId.get(
          collectorSettingBySourceId.get(source.id)?.id ?? "",
        ) ?? null,
      ),
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
      .orderBy("created_at", "asc")
      .executeTakeFirst();

    if (collectorSetting === undefined) {
      return null;
    }

    const collectorSettingSnapshot = await this.database
      .selectFrom("collector_setting_snapshots")
      .selectAll()
      .where("collector_setting_id", "=", collectorSetting.id)
      .orderBy("version", "desc")
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

  public async listPeriodicCrawlTargets(): Promise<
    PeriodicCrawlSourceTarget[]
  > {
    const rows = await this.database
      .selectFrom("collector_setting_snapshots as css")
      .innerJoin(
        "collector_settings as cs",
        "css.collector_setting_id",
        "cs.id",
      )
      .innerJoin("sources as s", "cs.source_id", "s.id")
      .select([
        "css.collector_setting_id",
        "css.config",
        "css.enabled",
        "css.id as collector_setting_snapshot_id",
        "css.periodical",
        "css.periodical_interval_minutes",
        "cs.id as collector_setting_id",
        "cs.plugin_slug",
        "s.id as source_id",
        "s.kind",
        "s.slug",
        "s.url",
      ])
      .orderBy("css.collector_setting_id", "asc")
      .orderBy("css.version", "desc")
      .execute();
    const targets: PeriodicCrawlSourceTarget[] = [];
    const seenCollectorSettingIds = new Set<string>();

    for (const row of rows) {
      if (seenCollectorSettingIds.has(row.collector_setting_id)) {
        continue;
      }

      seenCollectorSettingIds.add(row.collector_setting_id);

      if (!row.enabled || !row.periodical) {
        continue;
      }

      targets.push({
        collectorSettingId: row.collector_setting_id,
        collectorSettingSnapshotId: row.collector_setting_snapshot_id,
        config: row.config,
        crawlEnabled: row.periodical,
        crawlIntervalMinutes: row.periodical_interval_minutes,
        pluginSlug: row.plugin_slug,
        slug: row.slug,
        sourceId: row.source_id,
        sourceKind: row.kind,
        url: row.url,
      });
    }

    return targets;
  }

  public async updateSourceCollectorSettings(
    sourceId: string,
    settings: SourcePeriodicCrawlSettings,
    baseVersion: number,
  ): Promise<SourceListItem | null> {
    try {
      return await this.database.transaction().execute(async (transaction) => {
        const currentSetting = await transaction
          .selectFrom("collector_setting_snapshots as css")
          .innerJoin(
            "collector_settings as cs",
            "css.collector_setting_id",
            "cs.id",
          )
          .select([
            "cs.id as collector_setting_id",
            "css.config",
            "css.enabled",
            "css.periodical",
            "css.periodical_interval_minutes",
            "css.version as collector_setting_version",
          ])
          .where("cs.source_id", "=", sourceId)
          .orderBy("css.version", "desc")
          .limit(1)
          .executeTakeFirst();

        if (currentSetting === undefined) {
          return null;
        }

        if (currentSetting.collector_setting_version !== baseVersion) {
          throw new CollectorSettingsVersionConflictError();
        }

        const nextVersion = currentSetting.collector_setting_version + 1;
        await transaction
          .insertInto("collector_setting_snapshots")
          .values({
            collector_setting_id: currentSetting.collector_setting_id,
            config: currentSetting.config,
            enabled: currentSetting.enabled,
            id: crypto.randomUUID(),
            periodical: settings.enabled,
            periodical_interval_minutes: settings.intervalMinutes,
            recorded_at: new Date(),
            version: nextVersion,
          })
          .executeTakeFirstOrThrow();

        const source = await transaction
          .selectFrom("sources")
          .selectAll()
          .where("id", "=", sourceId)
          .executeTakeFirstOrThrow();
        const sourceSnapshot = await transaction
          .selectFrom("source_snapshots")
          .selectAll()
          .where("source_id", "=", sourceId)
          .orderBy("version", "desc")
          .executeTakeFirst();

        return {
          collectorSettingsVersion: nextVersion,
          createdAt: source.created_at,
          description: sourceSnapshot?.description ?? null,
          id: source.id,
          kind: source.kind,
          periodicCrawlEnabled: settings.enabled,
          periodicCrawlIntervalMinutes: settings.intervalMinutes,
          recordedAt: sourceSnapshot?.recorded_at ?? null,
          slug: source.slug,
          title: sourceSnapshot?.title ?? null,
          url: source.url,
          urlHash: source.url_hash,
          version: sourceSnapshot?.version ?? null,
        };
      });
    } catch (error) {
      if (isCollectorSettingsVersionConflictError(error)) {
        throw new CollectorSettingsVersionConflictError();
      }

      throw error;
    }
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

function isCollectorSettingsVersionConflictError(error: unknown): boolean {
  if (error instanceof CollectorSettingsVersionConflictError) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const constraint = "collector_setting_snapshots_setting_id_version_key";
  const errorWithCode = error as Error & {
    code?: string;
    constraint?: string;
    detail?: string;
  };

  return (
    errorWithCode.code === "23505" &&
    (errorWithCode.constraint === constraint ||
      error.message.includes(constraint) ||
      errorWithCode.detail?.includes(constraint) === true)
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
    periodical: defaultSourcePeriodicCrawlSettings().enabled,
    periodical_interval_minutes:
      defaultSourcePeriodicCrawlSettings().intervalMinutes,
    recorded_at: new Date(),
    version: 1,
  };
}

function toSourceListItem(
  source: Selectable<SourceTable>,
  snapshot: Selectable<SourceSnapshotTable> | null,
  collectorSettingSnapshot: Selectable<CollectorSettingSnapshotTable> | null,
): SourceListItem {
  return {
    collectorSettingsVersion: collectorSettingSnapshot?.version ?? null,
    periodicCrawlEnabled: collectorSettingSnapshot?.periodical ?? false,
    periodicCrawlIntervalMinutes:
      collectorSettingSnapshot?.periodical_interval_minutes ??
      defaultSourcePeriodicCrawlSettings().intervalMinutes,
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
    crawlEnabled: collectorSettingSnapshot.periodical,
    crawlIntervalMinutes: collectorSettingSnapshot.periodical_interval_minutes,
    pluginSlug: collectorSetting.plugin_slug,
    slug: source.slug,
    sourceId: source.id,
    sourceKind: source.kind,
    url: source.url,
  };
}
