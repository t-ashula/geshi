import type { AppDependencies } from "../../../deps.js";
import type { Result } from "../../../lib/result.js";
import { err } from "../../../lib/result.js";
import type { PeriodicCrawlAppSettings } from "../../../service/periodic-crawl-settings.js";

export type PeriodicCrawlSettingsEndpointError = {
  code:
    | "periodic_crawl_settings_load_failed"
    | "periodic_crawl_settings_update_failed";
  message: string;
};

export type PatchPeriodicCrawlSettingsInput = {
  enabled: boolean;
  intervalMinutes: number;
};

export function createGetPeriodicCrawlSettingsEndpoint(
  dependencies: AppDependencies,
) {
  return async (): Promise<
    Result<PeriodicCrawlAppSettings, PeriodicCrawlSettingsEndpointError>
  > => {
    const settings =
      await dependencies.appSettingService.getPeriodicCrawlSettings();

    if (!settings.ok) {
      return err({
        code: "periodic_crawl_settings_load_failed",
        message: settings.error.message,
      });
    }

    return settings;
  };
}

export function createPatchPeriodicCrawlSettingsEndpoint(
  dependencies: AppDependencies,
) {
  return async (
    input: PatchPeriodicCrawlSettingsInput,
  ): Promise<
    Result<PeriodicCrawlAppSettings, PeriodicCrawlSettingsEndpointError>
  > => {
    const settings =
      await dependencies.appSettingService.updatePeriodicCrawlSettings({
        enabled: input.enabled,
        intervalMinutes: input.intervalMinutes,
      });

    if (!settings.ok) {
      return err({
        code: "periodic_crawl_settings_update_failed",
        message: settings.error.message,
      });
    }

    return settings;
  };
}
