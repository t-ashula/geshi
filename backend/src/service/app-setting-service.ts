import type { AppSettingRepository } from "../db/app-setting-repository.js";
import type { Result } from "../lib/result.js";
import { err, ok } from "../lib/result.js";
import type { PeriodicCrawlAppSettings } from "./periodic-crawl-settings.js";
import {
  defaultPeriodicCrawlAppSettings,
  normalizePeriodicCrawlAppSettings,
} from "./periodic-crawl-settings.js";

const DEFAULT_APP_SETTINGS_PROFILE_SLUG = "default";

export class AppSettingService {
  public constructor(
    private readonly appSettingRepository: AppSettingRepository,
  ) {}

  public async getPeriodicCrawlSettings(): Promise<
    Result<PeriodicCrawlAppSettings, Error>
  > {
    try {
      const appSetting = await this.appSettingRepository.findLatestByProfile(
        DEFAULT_APP_SETTINGS_PROFILE_SLUG,
      );

      if (appSetting === null) {
        const defaults = defaultPeriodicCrawlAppSettings();

        await this.appSettingRepository.upsert(
          DEFAULT_APP_SETTINGS_PROFILE_SLUG,
          defaults,
        );

        return ok(defaults);
      }

      return ok(
        normalizePeriodicCrawlAppSettings({
          enabled: appSetting.enabled,
          intervalMinutes: appSetting.intervalMinutes,
        }),
      );
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to get periodic crawl settings."),
      );
    }
  }

  public async updatePeriodicCrawlSettings(
    settings: PeriodicCrawlAppSettings,
  ): Promise<PeriodicCrawlAppSettings> {
    const normalizedSettings = normalizePeriodicCrawlAppSettings(settings);

    await this.appSettingRepository.upsert(
      DEFAULT_APP_SETTINGS_PROFILE_SLUG,
      normalizedSettings,
    );

    return normalizedSettings;
  }

  public async ensureDefaultProfile(): Promise<void> {
    await this.appSettingRepository.ensureProfile(
      DEFAULT_APP_SETTINGS_PROFILE_SLUG,
    );
  }
}
