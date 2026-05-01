import type {
  AppSettingRepository,
  AppSettingRepositoryError,
} from "../db/app-setting-repository.js";
import type { Result } from "../lib/result.js";
import { ok } from "../lib/result.js";
import type { PeriodicCrawlAppSettings } from "./periodic-crawl-settings.js";
import {
  defaultPeriodicCrawlAppSettings,
  normalizePeriodicCrawlAppSettings,
} from "./periodic-crawl-settings.js";

const DEFAULT_APP_SETTINGS_PROFILE_SLUG = "default";

export interface AppSettingService {
  ensureDefaultProfile(): Promise<Result<void, AppSettingRepositoryError>>;
  getPeriodicCrawlSettings(): Promise<
    Result<PeriodicCrawlAppSettings, AppSettingRepositoryError>
  >;
  updatePeriodicCrawlSettings(
    settings: PeriodicCrawlAppSettings,
  ): Promise<Result<PeriodicCrawlAppSettings, AppSettingRepositoryError>>;
}

export function createAppSettingService(
  appSettingRepository: AppSettingRepository,
): AppSettingService {
  return {
    async ensureDefaultProfile(): Promise<
      Result<void, AppSettingRepositoryError>
    > {
      return appSettingRepository.ensureProfile(
        DEFAULT_APP_SETTINGS_PROFILE_SLUG,
      );
    },
    async getPeriodicCrawlSettings(): Promise<
      Result<PeriodicCrawlAppSettings, AppSettingRepositoryError>
    > {
      const appSetting = await appSettingRepository.findLatestByProfile(
        DEFAULT_APP_SETTINGS_PROFILE_SLUG,
      );

      if (!appSetting.ok) {
        return appSetting;
      }

      if (appSetting.value === null) {
        const defaults = defaultPeriodicCrawlAppSettings();
        const upsertResult = await appSettingRepository.upsert(
          DEFAULT_APP_SETTINGS_PROFILE_SLUG,
          defaults,
        );

        if (!upsertResult.ok) {
          return upsertResult;
        }

        return ok(defaults);
      }

      return ok(
        normalizePeriodicCrawlAppSettings({
          enabled: appSetting.value.enabled,
          intervalMinutes: appSetting.value.intervalMinutes,
        }),
      );
    },
    async updatePeriodicCrawlSettings(
      settings: PeriodicCrawlAppSettings,
    ): Promise<Result<PeriodicCrawlAppSettings, AppSettingRepositoryError>> {
      const normalizedSettings = normalizePeriodicCrawlAppSettings(settings);

      const upsertResult = await appSettingRepository.upsert(
        DEFAULT_APP_SETTINGS_PROFILE_SLUG,
        normalizedSettings,
      );

      if (!upsertResult.ok) {
        return upsertResult;
      }

      return ok(normalizedSettings);
    },
  };
}
