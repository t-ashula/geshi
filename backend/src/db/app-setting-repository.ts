import type { Kysely } from "kysely";

import type { Result } from "../lib/result.js";
import { err, ok } from "../lib/result.js";
import type { GeshiDatabase } from "./types.js";

export type AppSettingRecord = {
  enabled: boolean | null;
  id: string;
  intervalMinutes: number | null;
  profileSlug: string;
  snapshotId: string;
  version: number;
};

export type AppSettingRepositoryError = Error;

export class AppSettingRepository {
  public constructor(private readonly database: Kysely<GeshiDatabase>) {}

  public async ensureProfile(
    profileSlug: string,
  ): Promise<Result<void, AppSettingRepositoryError>> {
    try {
      const existingSetting = await this.database
        .selectFrom("app_settings")
        .select("id")
        .where("profile_slug", "=", profileSlug)
        .executeTakeFirst();

      if (existingSetting !== undefined) {
        return ok(undefined);
      }

      await this.database
        .insertInto("app_settings")
        .values({
          id: crypto.randomUUID(),
          profile_slug: profileSlug,
        })
        .executeTakeFirstOrThrow();

      return ok(undefined);
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to ensure app setting profile."),
      );
    }
  }

  public async findLatestByProfile(
    profileSlug: string,
  ): Promise<Result<AppSettingRecord | null, AppSettingRepositoryError>> {
    try {
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
        return ok(null);
      }

      return ok({
        enabled: row.enabled,
        id: row.app_setting_id,
        intervalMinutes: row.interval_minutes,
        profileSlug: row.profile_slug,
        snapshotId: row.snapshot_id,
        version: row.version,
      });
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to find latest app setting by profile."),
      );
    }
  }

  public async upsert(
    profileSlug: string,
    settings: {
      enabled: boolean;
      intervalMinutes: number;
    },
  ): Promise<Result<AppSettingRecord, AppSettingRepositoryError>> {
    try {
      return ok(
        await this.database.transaction().execute(async (transaction) => {
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
        }),
      );
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to upsert app setting."),
      );
    }
  }
}
