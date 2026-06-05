import type { Insertable, Kysely, Selectable } from "kysely";
import { sql } from "kysely";

import type { Result } from "../lib/result.js";
import { err, ok } from "../lib/result.js";
import type { JsonValue, SourceCollectorSourceKind } from "../plugins/types.js";
import type { SourcePeriodicCrawlSettings } from "../service/periodic-crawl-settings.js";
import { defaultSourcePeriodicCrawlSettings } from "../service/periodic-crawl-settings.js";
import type {
  CollectionTable,
  CollectorSettingSnapshotTable,
  CollectorSettingTable,
  GeshiDatabase,
  SourceSnapshotTable,
  SourceTable,
  SubscriptionEventTable,
  SubscriptionTable,
  UserTable,
} from "./types.js";

export type CreateSourceInput = {
  collectorSettingId: string;
  collectorSettingSnapshotId: string;
  description?: string | null;
  id: string;
  kind: SourceCollectorSourceKind;
  pluginSlug: string;
  slug: string;
  snapshotId: string;
  subscriptionEventId: string;
  subscriptionId: string;
  title?: string | null;
  url: string;
  urlHash: string;
  userSlug: string;
};

export type CreateCollectionInput = {
  id: string;
  parentCollectionId?: string | null;
  position: number;
  title: string;
  userSlug: string;
};

export type UpdateCollectionInput = {
  collectionId: string;
  parentCollectionId?: string | null;
  position?: number;
  title?: string;
  userSlug: string;
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
  sourceKind: SourceCollectorSourceKind;
  url: string;
};

export type SourceListItem = {
  collectionId: string | null;
  collectorSettingsVersion: number | null;
  periodicCrawlEnabled: boolean;
  periodicCrawlIntervalMinutes: number;
  createdAt: Date;
  description: string | null;
  id: string;
  kind: SourceCollectorSourceKind;
  recordedAt: Date | null;
  slug: string;
  subscriptionId: string;
  subscriptionPosition: number;
  title: string | null;
  url: string;
  urlHash: string;
  version: number | null;
};

export type SourceCollectionListItem = {
  createdAt: Date;
  id: string;
  parentCollectionId: string | null;
  position: number;
  sourceCount: number;
  title: string;
};

export type PeriodicCrawlSourceTarget = ObserveSourceTarget;
export type SourceCollectorSettingsRecord = {
  baseVersion: number;
  config: Record<string, JsonValue>;
  periodicCrawlEnabled: boolean;
  periodicCrawlIntervalMinutes: number;
  pluginSlug: string;
};
export type SourceRepositoryError =
  | CollectorSettingsVersionConflictError
  | DuplicateSourceUrlHashError
  | Error;

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

  public async createSource(
    input: CreateSourceInput,
  ): Promise<Result<SourceListItem, SourceRepositoryError>> {
    try {
      return ok(
        await this.database.transaction().execute(async (transaction) => {
          const user = await ensureUserBySlug(transaction, input.userSlug);
          const existingSource = await transaction
            .selectFrom("sources")
            .selectAll()
            .where("url_hash", "=", input.urlHash)
            .executeTakeFirst();

          const sourceId = existingSource?.id ?? input.id;

          if (existingSource === undefined) {
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
          }

          await transaction
            .insertInto("subscriptions")
            .values(toSubscriptionInsert(input, user.id, sourceId))
            .executeTakeFirstOrThrow();

          await transaction
            .insertInto("subscription_events")
            .values(toSubscriptionEventInsert(input, user.id, sourceId))
            .executeTakeFirstOrThrow();

          const source = await transaction
            .selectFrom("sources")
            .selectAll()
            .where("id", "=", sourceId)
            .executeTakeFirstOrThrow();
          const snapshot = await transaction
            .selectFrom("source_snapshots")
            .selectAll()
            .where("source_id", "=", sourceId)
            .orderBy("version", "desc")
            .executeTakeFirst();
          const collectorSetting = await transaction
            .selectFrom("collector_settings")
            .select("id")
            .where("source_id", "=", sourceId)
            .orderBy("created_at", "asc")
            .executeTakeFirstOrThrow();
          const collectorSettingSnapshot = await transaction
            .selectFrom("collector_setting_snapshots")
            .selectAll()
            .where("collector_setting_id", "=", collectorSetting.id)
            .orderBy("version", "desc")
            .executeTakeFirst();
          const subscription = await transaction
            .selectFrom("subscriptions")
            .selectAll()
            .where("id", "=", input.subscriptionId)
            .executeTakeFirstOrThrow();

          const item = toSourceListItem(
            source,
            snapshot ?? null,
            collectorSettingSnapshot ?? null,
          );
          return {
            ...item,
            collectionId: subscription.collection_id,
            subscriptionId: subscription.id,
            subscriptionPosition: subscription.position,
          };
        }),
      );
    } catch (error) {
      if (
        isDuplicateSourceUrlHashError(error) ||
        isDuplicateSubscriptionError(error)
      ) {
        return err(new DuplicateSourceUrlHashError(input.urlHash));
      }

      return err(
        error instanceof Error ? error : new Error("Failed to create source."),
      );
    }
  }

  public async listSources(
    userSlug: string,
  ): Promise<Result<SourceListItem[], SourceRepositoryError>> {
    try {
      const latestSourceSnapshots = latestSourceSnapshotsQuery(this.database);
      const latestCollectorSettingSnapshots =
        latestCollectorSettingSnapshotsQuery(this.database);

      const sources = await this.database
        .selectFrom("subscriptions")
        .innerJoin("users", "users.id", "subscriptions.user_id")
        .innerJoin("sources", "sources.id", "subscriptions.source_id")
        .leftJoin(
          latestSourceSnapshots.as("latest_source_snapshots"),
          "latest_source_snapshots.source_id",
          "sources.id",
        )
        .leftJoin(
          "collector_settings",
          "collector_settings.source_id",
          "sources.id",
        )
        .leftJoin(
          latestCollectorSettingSnapshots.as(
            "latest_collector_setting_snapshots",
          ),
          "latest_collector_setting_snapshots.collector_setting_id",
          "collector_settings.id",
        )
        .select([
          "subscriptions.collection_id",
          "subscriptions.id as subscription_id",
          "subscriptions.created_at as subscription_created_at",
          "subscriptions.position as subscription_position",
          "sources.created_at",
          "sources.id",
          "sources.kind",
          "sources.slug",
          "sources.url",
          "sources.url_hash",
          "latest_source_snapshots.description",
          "latest_source_snapshots.recorded_at",
          "latest_source_snapshots.title",
          "latest_source_snapshots.version",
          "latest_collector_setting_snapshots.enabled",
          "latest_collector_setting_snapshots.periodical_interval_minutes",
          "latest_collector_setting_snapshots.version as collector_settings_version",
        ])
        .where("users.slug", "=", userSlug)
        .orderBy("subscriptions.collection_id", "asc")
        .orderBy("subscriptions.position", "asc")
        .orderBy("subscriptions.created_at", "desc")
        .execute();
      return ok(sources.map(toJoinedSourceListItem));
    } catch (error) {
      return err(
        error instanceof Error ? error : new Error("Failed to list sources."),
      );
    }
  }

  public async listCollections(
    userSlug: string,
  ): Promise<Result<SourceCollectionListItem[], SourceRepositoryError>> {
    try {
      const collections = await this.database
        .selectFrom("collections")
        .innerJoin("users", "users.id", "collections.user_id")
        .leftJoin(
          "subscriptions",
          "subscriptions.collection_id",
          "collections.id",
        )
        .select([
          "collections.created_at",
          "collections.id",
          "collections.parent_collection_id",
          "collections.position",
          "collections.title",
          sql<number>`count(subscriptions.id)`.as("source_count"),
        ])
        .where("users.slug", "=", userSlug)
        .groupBy([
          "collections.created_at",
          "collections.id",
          "collections.parent_collection_id",
          "collections.position",
          "collections.title",
        ])
        .orderBy("collections.position", "asc")
        .orderBy("collections.created_at", "asc")
        .execute();

      return ok(
        collections.map((collection) => ({
          createdAt: collection.created_at,
          id: collection.id,
          parentCollectionId: collection.parent_collection_id,
          position: collection.position,
          sourceCount: collection.source_count,
          title: collection.title,
        })),
      );
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to list collections."),
      );
    }
  }

  public async createCollection(
    input: CreateCollectionInput,
  ): Promise<Result<SourceCollectionListItem, SourceRepositoryError>> {
    try {
      return ok(
        await this.database.transaction().execute(async (transaction) => {
          const user = await ensureUserBySlug(transaction, input.userSlug);
          await transaction
            .insertInto("collections")
            .values({
              id: input.id,
              parent_collection_id: input.parentCollectionId ?? null,
              position: input.position,
              title: input.title,
              user_id: user.id,
            })
            .executeTakeFirstOrThrow();

          const collection = await transaction
            .selectFrom("collections")
            .selectAll()
            .where("id", "=", input.id)
            .executeTakeFirstOrThrow();

          return toCollectionListItem(collection, 0);
        }),
      );
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to create collection."),
      );
    }
  }

  public async updateCollection(
    input: UpdateCollectionInput,
  ): Promise<Result<SourceCollectionListItem | null, SourceRepositoryError>> {
    try {
      return ok(
        await this.database.transaction().execute(async (transaction) => {
          const user = await transaction
            .selectFrom("users")
            .select("id")
            .where("slug", "=", input.userSlug)
            .executeTakeFirst();

          if (user === undefined) {
            return null;
          }

          const collection = await transaction
            .selectFrom("collections")
            .selectAll()
            .where("id", "=", input.collectionId)
            .where("user_id", "=", user.id)
            .executeTakeFirst();

          if (collection === undefined) {
            return null;
          }

          await transaction
            .updateTable("collections")
            .set({
              parent_collection_id:
                input.parentCollectionId === undefined
                  ? collection.parent_collection_id
                  : input.parentCollectionId,
              position: input.position ?? collection.position,
              title: input.title ?? collection.title,
            })
            .where("id", "=", input.collectionId)
            .executeTakeFirstOrThrow();

          const updatedCollection = await transaction
            .selectFrom("collections")
            .selectAll()
            .where("id", "=", input.collectionId)
            .executeTakeFirstOrThrow();
          const subscriptionCountRow = await transaction
            .selectFrom("subscriptions")
            .select(sql<number>`count(id)`.as("count"))
            .where("collection_id", "=", input.collectionId)
            .executeTakeFirstOrThrow();

          return toCollectionListItem(
            updatedCollection,
            subscriptionCountRow.count,
          );
        }),
      );
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to update collection."),
      );
    }
  }

  public async assignSourceToCollection(
    userSlug: string,
    sourceId: string,
    collectionId: string | null,
    position: number,
  ): Promise<Result<SourceListItem | null, SourceRepositoryError>> {
    try {
      return ok(
        await this.database.transaction().execute(async (transaction) => {
          const user = await transaction
            .selectFrom("users")
            .select("id")
            .where("slug", "=", userSlug)
            .executeTakeFirst();

          if (user === undefined) {
            return null;
          }

          if (collectionId !== null) {
            const collection = await transaction
              .selectFrom("collections")
              .select("id")
              .where("id", "=", collectionId)
              .where("user_id", "=", user.id)
              .executeTakeFirst();

            if (collection === undefined) {
              return null;
            }
          }

          const subscription = await transaction
            .selectFrom("subscriptions")
            .selectAll()
            .where("source_id", "=", sourceId)
            .where("user_id", "=", user.id)
            .executeTakeFirst();

          if (subscription === undefined) {
            return null;
          }

          await transaction
            .updateTable("subscriptions")
            .set({
              collection_id: collectionId,
              position,
            })
            .where("id", "=", subscription.id)
            .executeTakeFirstOrThrow();

          return findSourceListItemBySubscriptionId(
            transaction,
            subscription.id,
          );
        }),
      );
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to assign source to collection."),
      );
    }
  }

  public async findObserveSourceTarget(
    sourceId: string,
  ): Promise<Result<ObserveSourceTarget | null, SourceRepositoryError>> {
    try {
      const source = await this.database
        .selectFrom("sources")
        .selectAll()
        .where("id", "=", sourceId)
        .executeTakeFirst();

      if (source === undefined) {
        return ok(null);
      }

      const collectorSetting = await this.database
        .selectFrom("collector_settings")
        .selectAll()
        .where("source_id", "=", sourceId)
        .orderBy("created_at", "asc")
        .executeTakeFirst();

      if (collectorSetting === undefined) {
        return ok(null);
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
        return ok(null);
      }

      return ok(
        toObserveSourceTarget(
          source,
          collectorSetting,
          collectorSettingSnapshot,
        ),
      );
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to find observe source target."),
      );
    }
  }

  public async listPeriodicCrawlTargets(): Promise<
    Result<PeriodicCrawlSourceTarget[], SourceRepositoryError>
  > {
    try {
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

      return ok(targets);
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to list periodic crawl targets."),
      );
    }
  }

  public async findSourceCollectorSettings(
    sourceId: string,
  ): Promise<
    Result<SourceCollectorSettingsRecord | null, SourceRepositoryError>
  > {
    try {
      const currentSetting = await this.database
        .selectFrom("collector_setting_snapshots as css")
        .innerJoin(
          "collector_settings as cs",
          "css.collector_setting_id",
          "cs.id",
        )
        .select([
          "cs.plugin_slug",
          "css.config",
          "css.periodical",
          "css.periodical_interval_minutes",
          "css.version as collector_setting_version",
        ])
        .where("cs.source_id", "=", sourceId)
        .orderBy("css.version", "desc")
        .limit(1)
        .executeTakeFirst();

      if (currentSetting === undefined) {
        return ok(null);
      }

      return ok({
        baseVersion: currentSetting.collector_setting_version,
        config: currentSetting.config as Record<string, JsonValue>,
        periodicCrawlEnabled: currentSetting.periodical,
        periodicCrawlIntervalMinutes:
          currentSetting.periodical_interval_minutes,
        pluginSlug: currentSetting.plugin_slug,
      });
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to find source collector settings."),
      );
    }
  }

  public async updateSourceCollectorSettings(
    userSlug: string,
    sourceId: string,
    settings: SourcePeriodicCrawlSettings,
    baseVersion: number,
    config: Record<string, JsonValue>,
  ): Promise<Result<SourceListItem | null, SourceRepositoryError>> {
    try {
      return ok(
        await this.database.transaction().execute(async (transaction) => {
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
              config,
              enabled: currentSetting.enabled,
              id: crypto.randomUUID(),
              periodical: settings.enabled,
              periodical_interval_minutes: settings.intervalMinutes,
              recorded_at: new Date(),
              version: nextVersion,
            })
            .executeTakeFirstOrThrow();
          const user = await transaction
            .selectFrom("users")
            .select("id")
            .where("slug", "=", userSlug)
            .executeTakeFirst();

          if (user === undefined) {
            return null;
          }

          const subscription = await transaction
            .selectFrom("subscriptions")
            .select("id")
            .where("source_id", "=", sourceId)
            .where("user_id", "=", user.id)
            .executeTakeFirst();

          if (subscription === undefined) {
            return null;
          }

          return findSourceListItemBySubscriptionId(
            transaction,
            subscription.id,
          );
        }),
      );
    } catch (error) {
      if (isCollectorSettingsVersionConflictError(error)) {
        return err(new CollectorSettingsVersionConflictError());
      }

      return err(
        error instanceof Error
          ? error
          : new Error("Failed to update source collector settings."),
      );
    }
  }

  public async unsubscribe(
    userSlug: string,
    subscriptionId: string,
  ): Promise<Result<boolean, SourceRepositoryError>> {
    try {
      return ok(
        await this.database.transaction().execute(async (transaction) => {
          const user = await transaction
            .selectFrom("users")
            .select("id")
            .where("slug", "=", userSlug)
            .executeTakeFirst();

          if (user === undefined) {
            return false;
          }

          const subscription = await transaction
            .selectFrom("subscriptions")
            .selectAll()
            .where("id", "=", subscriptionId)
            .where("user_id", "=", user.id)
            .executeTakeFirst();

          if (subscription === undefined) {
            return false;
          }

          const unsubscribedAt = new Date();

          await transaction
            .insertInto("subscription_events")
            .values({
              id: crypto.randomUUID(),
              kind: "unsubscribed",
              occurred_at: unsubscribedAt,
              source_id: subscription.source_id,
              user_id: subscription.user_id,
            })
            .executeTakeFirstOrThrow();

          await transaction
            .deleteFrom("subscriptions")
            .where("id", "=", subscription.id)
            .executeTakeFirstOrThrow();

          return true;
        }),
      );
    } catch (error) {
      return err(
        error instanceof Error ? error : new Error("Failed to unsubscribe."),
      );
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

function isDuplicateSubscriptionError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const constraint = "subscriptions_user_id_source_id_key";
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

async function ensureUserBySlug(
  database: Kysely<GeshiDatabase>,
  userSlug: string,
): Promise<Selectable<UserTable>> {
  const existingUser = await database
    .selectFrom("users")
    .selectAll()
    .where("slug", "=", userSlug)
    .executeTakeFirst();

  if (existingUser !== undefined) {
    return existingUser;
  }

  const id = crypto.randomUUID();
  await database
    .insertInto("users")
    .values({
      id,
      slug: userSlug,
    })
    .executeTakeFirstOrThrow();

  return database
    .selectFrom("users")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirstOrThrow();
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

function toSubscriptionInsert(
  input: CreateSourceInput,
  userId: string,
  sourceId: string,
): Insertable<SubscriptionTable> {
  return {
    collection_id: null,
    id: input.subscriptionId,
    position: 0,
    source_id: sourceId,
    user_id: userId,
  };
}

function toSubscriptionEventInsert(
  input: CreateSourceInput,
  userId: string,
  sourceId: string,
): Insertable<SubscriptionEventTable> {
  return {
    id: input.subscriptionEventId,
    kind: "subscribed",
    occurred_at: new Date(),
    source_id: sourceId,
    user_id: userId,
  };
}

function toSourceListItem(
  source: Selectable<SourceTable>,
  snapshot: Selectable<SourceSnapshotTable> | null,
  collectorSettingSnapshot: Selectable<CollectorSettingSnapshotTable> | null,
): SourceListItem {
  return {
    collectionId: null,
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
    subscriptionId: "",
    subscriptionPosition: 0,
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

function toJoinedSourceListItem(source: {
  collection_id: string | null;
  collector_settings_version: number | null;
  created_at: Date;
  description: string | null;
  enabled: boolean | null;
  id: string;
  kind: SourceCollectorSourceKind;
  periodical_interval_minutes: number | null;
  recorded_at: Date | null;
  slug: string;
  subscription_id: string;
  title: string | null;
  url: string;
  url_hash: string;
  version: number | null;
  subscription_created_at: Date;
  subscription_position: number;
}): SourceListItem {
  return {
    collectionId: source.collection_id,
    collectorSettingsVersion: source.collector_settings_version,
    periodicCrawlEnabled: source.enabled ?? false,
    periodicCrawlIntervalMinutes:
      source.periodical_interval_minutes ??
      defaultSourcePeriodicCrawlSettings().intervalMinutes,
    createdAt: source.created_at,
    description: source.description,
    id: source.id,
    kind: source.kind,
    recordedAt: source.recorded_at,
    slug: source.slug,
    subscriptionId: source.subscription_id,
    subscriptionPosition: source.subscription_position,
    title: source.title,
    url: source.url,
    urlHash: source.url_hash,
    version: source.version,
  };
}

function toCollectionListItem(
  collection: Selectable<CollectionTable>,
  sourceCount: number,
): SourceCollectionListItem {
  return {
    createdAt: collection.created_at,
    id: collection.id,
    parentCollectionId: collection.parent_collection_id,
    position: collection.position,
    sourceCount,
    title: collection.title,
  };
}

async function findSourceListItemBySubscriptionId(
  database: Kysely<GeshiDatabase>,
  subscriptionId: string,
): Promise<SourceListItem | null> {
  const latestSourceSnapshots = latestSourceSnapshotsQuery(database);
  const latestCollectorSettingSnapshots =
    latestCollectorSettingSnapshotsQuery(database);

  const row = await database
    .selectFrom("subscriptions")
    .innerJoin("sources", "sources.id", "subscriptions.source_id")
    .leftJoin(
      latestSourceSnapshots.as("latest_source_snapshots"),
      "latest_source_snapshots.source_id",
      "sources.id",
    )
    .leftJoin(
      "collector_settings",
      "collector_settings.source_id",
      "sources.id",
    )
    .leftJoin(
      latestCollectorSettingSnapshots.as("latest_collector_setting_snapshots"),
      "latest_collector_setting_snapshots.collector_setting_id",
      "collector_settings.id",
    )
    .select([
      "subscriptions.collection_id",
      "subscriptions.id as subscription_id",
      "subscriptions.created_at as subscription_created_at",
      "subscriptions.position as subscription_position",
      "sources.created_at",
      "sources.id",
      "sources.kind",
      "sources.slug",
      "sources.url",
      "sources.url_hash",
      "latest_source_snapshots.description",
      "latest_source_snapshots.recorded_at",
      "latest_source_snapshots.title",
      "latest_source_snapshots.version",
      "latest_collector_setting_snapshots.enabled",
      "latest_collector_setting_snapshots.periodical_interval_minutes",
      "latest_collector_setting_snapshots.version as collector_settings_version",
    ])
    .where("subscriptions.id", "=", subscriptionId)
    .executeTakeFirst();

  return row === undefined ? null : toJoinedSourceListItem(row);
}

function latestSourceSnapshotsQuery(database: Kysely<GeshiDatabase>) {
  return database
    .selectFrom("source_snapshots as source_snapshots")
    .innerJoin(
      database
        .selectFrom("source_snapshots")
        .select(["source_id", sql<number>`max(version)`.as("version")])
        .groupBy("source_id")
        .as("latest_source_snapshot_versions"),
      (join) =>
        join
          .onRef(
            "source_snapshots.source_id",
            "=",
            "latest_source_snapshot_versions.source_id",
          )
          .onRef(
            "source_snapshots.version",
            "=",
            "latest_source_snapshot_versions.version",
          ),
    )
    .select([
      "source_snapshots.description",
      "source_snapshots.recorded_at",
      "source_snapshots.source_id",
      "source_snapshots.title",
      "source_snapshots.version",
    ]);
}

function latestCollectorSettingSnapshotsQuery(database: Kysely<GeshiDatabase>) {
  return database
    .selectFrom("collector_setting_snapshots as collector_setting_snapshots")
    .innerJoin(
      database
        .selectFrom("collector_setting_snapshots")
        .select([
          "collector_setting_id",
          sql<number>`max(version)`.as("version"),
        ])
        .groupBy("collector_setting_id")
        .as("latest_collector_setting_snapshot_versions"),
      (join) =>
        join
          .onRef(
            "collector_setting_snapshots.collector_setting_id",
            "=",
            "latest_collector_setting_snapshot_versions.collector_setting_id",
          )
          .onRef(
            "collector_setting_snapshots.version",
            "=",
            "latest_collector_setting_snapshot_versions.version",
          ),
    )
    .select([
      "collector_setting_snapshots.collector_setting_id",
      "collector_setting_snapshots.enabled",
      "collector_setting_snapshots.periodical_interval_minutes",
      "collector_setting_snapshots.version",
    ]);
}
