import { PluginGlobalRuntimeStateVersionConflictError } from "../../../db/plugin-global-runtime-state-repository.js";
import type { AppDependencies } from "../../../deps.js";
import type { Result } from "../../../lib/result.js";
import { err } from "../../../lib/result.js";
import type { PeriodicCrawlAppSettings } from "../../../service/periodic-crawl-settings.js";
import type { PluginGlobalSettingsDetail } from "../../../service/plugin-global-settings-service.js";
import type { SourceCollectorSettingValue } from "../../../service/source-service.js";

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

export type PluginGlobalSettingsEndpointError = {
  code:
    | "plugin_global_settings_load_failed"
    | "plugin_global_settings_update_failed"
    | "plugin_global_settings_conflict"
    | "plugin_not_found";
  message: string;
};

export type PatchPluginGlobalSettingsInput = {
  baseVersion: number | null;
  items: Array<{
    key: string;
    value: SourceCollectorSettingValue;
  }>;
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

export function createGetPluginGlobalSettingsEndpoint(
  dependencies: AppDependencies,
) {
  return async (
    pluginSlug: string,
  ): Promise<
    Result<PluginGlobalSettingsDetail, PluginGlobalSettingsEndpointError>
  > => {
    const settings =
      await dependencies.pluginGlobalSettingsService.getPluginGlobalSettings(
        pluginSlug,
      );

    if (!settings.ok) {
      if (!(settings.error instanceof Error)) {
        return err(settings.error);
      }

      return err({
        code: "plugin_global_settings_load_failed",
        message: settings.error.message,
      });
    }

    return settings;
  };
}

export function createPatchPluginGlobalSettingsEndpoint(
  dependencies: AppDependencies,
) {
  return async (
    pluginSlug: string,
    input: PatchPluginGlobalSettingsInput,
  ): Promise<
    Result<PluginGlobalSettingsDetail, PluginGlobalSettingsEndpointError>
  > => {
    const settings =
      await dependencies.pluginGlobalSettingsService.updatePluginGlobalSettings(
        pluginSlug,
        input.baseVersion,
        input.items,
      );

    if (!settings.ok) {
      if (
        settings.error instanceof PluginGlobalRuntimeStateVersionConflictError
      ) {
        return err({
          code: "plugin_global_settings_conflict",
          message: settings.error.message,
        });
      }

      if (!(settings.error instanceof Error)) {
        return err(settings.error);
      }

      return err({
        code: "plugin_global_settings_update_failed",
        message: settings.error.message,
      });
    }

    return settings;
  };
}
