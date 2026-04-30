import type { Kysely } from "kysely";

import type { GeshiDatabase } from "./types.js";

export type AppSettingRecord = {
  enabled: boolean | null;
  id: string;
  intervalMinutes: number | null;
  profileSlug: string;
  snapshotId: string;
  version: number;
};

export class AppSettingRepository {
  public constructor(private readonly database: Kysely<GeshiDatabase>) {}

  public async ensureProfile(profileSlug: string): Promise<void> {
    const existingSetting = await this.database
      .selectFrom("app_settings")
      .select("id")
      .where("profile_slug", "=", profileSlug)
      .executeTakeFirst();

    if (existingSetting !== undefined) {
      return;
    }

    await this.database
      .insertInto("app_settings")
      .values({
        id: crypto.randomUUID(),
        profile_slug: profileSlug,
      })
      .executeTakeFirstOrThrow();
  }

  public async findLatestByProfile(
    profileSlug: string,
  ): Promise<AppSettingRecord | null> {
    const row = await this.database
      .selectFrom("app_settings")
      .innerJoin(
        "app_setting_snapshots",
        "app_setting_snapshots.app_setting_id",
        "app_settings.id",
      )
      .select([
        "app_settings.id as app_setting_id",
        "app_setting_snapshots.id as snapshot_id",
        "app_settings.profile_slug",
        "app_setting_snapshots.enabled",
        "app_setting_snapshots.interval_minutes",
        "app_setting_snapshots.version",
      ])
      .where("app_settings.profile_slug", "=", profileSlug)
      .orderBy("version", "desc")
      .executeTakeFirst();

    if (row === undefined) {
      return null;
    }

    return {
      enabled: row.enabled,
      id: row.app_setting_id,
      intervalMinutes: row.interval_minutes,
      profileSlug: row.profile_slug,
      snapshotId: row.snapshot_id,
      version: row.version,
    };
  }

  public async upsert(
    profileSlug: string,
    settings: {
      enabled: boolean;
      intervalMinutes: number;
    },
  ): Promise<AppSettingRecord> {
    return this.database.transaction().execute(async (transaction) => {
      const existingSetting = await transaction
        .selectFrom("app_settings")
        .selectAll()
        .where("profile_slug", "=", profileSlug)
        .executeTakeFirst();

      if (existingSetting === undefined) {
        const id = crypto.randomUUID();

        await transaction
          .insertInto("app_settings")
          .values({
            id,
            profile_slug: profileSlug,
          })
          .executeTakeFirstOrThrow();

        const snapshotId = crypto.randomUUID();

        await transaction
          .insertInto("app_setting_snapshots")
          .values({
            app_setting_id: id,
            enabled: settings.enabled,
            id: snapshotId,
            interval_minutes: settings.intervalMinutes,
            recorded_at: new Date(),
            version: 1,
          })
          .executeTakeFirstOrThrow();

        return {
          enabled: settings.enabled,
          id,
          intervalMinutes: settings.intervalMinutes,
          profileSlug,
          snapshotId,
          version: 1,
        };
      }

      const latestSnapshot = await transaction
        .selectFrom("app_setting_snapshots")
        .selectAll()
        .where("app_setting_id", "=", existingSetting.id)
        .orderBy("version", "desc")
        .executeTakeFirst();

      const nextVersion = (latestSnapshot?.version ?? 0) + 1;
      const snapshotId = crypto.randomUUID();

      await transaction
        .insertInto("app_setting_snapshots")
        .values({
          app_setting_id: existingSetting.id,
          enabled: settings.enabled,
          id: snapshotId,
          interval_minutes: settings.intervalMinutes,
          recorded_at: new Date(),
          version: nextVersion,
        })
        .executeTakeFirstOrThrow();

      return {
        enabled: settings.enabled,
        id: existingSetting.id,
        intervalMinutes: settings.intervalMinutes,
        profileSlug: existingSetting.profile_slug,
        snapshotId,
        version: nextVersion,
      };
    });
  }
}
