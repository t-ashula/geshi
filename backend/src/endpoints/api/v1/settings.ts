import { PluginGlobalRuntimeStateVersionConflictError } from "../../../db/plugin-global-runtime-state-repository.js";
import type {
  DetectedSourceCandidate,
  SourceDetectionTarget,
} from "../../../db/source-detection-repository.js";
import type { AppDependencies } from "../../../deps.js";
import type { Result } from "../../../lib/result.js";
import { err } from "../../../lib/result.js";
import type { JsonObject } from "../../../plugins/types.js";
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

export type CreateSourceDetectionTargetInput = {
  config?: JsonObject;
  enabled?: boolean;
  intervalMinutes?: number;
  pluginSlug: string;
  sourceKind: "feed" | "podcast" | "streaming";
  url: string;
};

export type SourceDetectionTargetEndpointError = {
  code:
    | "source_detection_target_list_failed"
    | "source_detection_target_create_failed"
    | "source_detection_target_update_failed"
    | "source_detection_candidate_dismiss_failed"
    | "source_detection_candidate_list_failed"
    | "source_detection_candidate_register_failed";
  message: string;
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

export function createListSourceDetectionTargetsEndpoint(
  dependencies: AppDependencies,
) {
  return async (): Promise<
    Result<SourceDetectionTarget[], SourceDetectionTargetEndpointError>
  > => {
    const result =
      await dependencies.sourceDetectionService.listEnabledTargets();

    if (!result.ok) {
      return err({
        code: "source_detection_target_list_failed",
        message: result.error.message,
      });
    }

    return result;
  };
}

export function createCreateSourceDetectionTargetEndpoint(
  dependencies: AppDependencies,
) {
  return async (
    input: CreateSourceDetectionTargetInput,
  ): Promise<
    Result<SourceDetectionTarget, SourceDetectionTargetEndpointError>
  > => {
    const result =
      await dependencies.sourceDetectionService.createSourceDetectionTarget(
        input,
      );

    if (!result.ok) {
      return err({
        code: "source_detection_target_create_failed",
        message: result.error.message,
      });
    }

    return result;
  };
}

export function createPatchSourceDetectionTargetEndpoint(
  dependencies: AppDependencies,
) {
  return async (
    input: CreateSourceDetectionTargetInput & { id: string },
  ): Promise<
    Result<SourceDetectionTarget, SourceDetectionTargetEndpointError>
  > => {
    const result =
      await dependencies.sourceDetectionService.updateSourceDetectionTarget(
        input,
      );

    if (!result.ok) {
      return err({
        code: "source_detection_target_update_failed",
        message: result.error.message,
      });
    }

    return result;
  };
}

export function createListDetectedSourceCandidatesEndpoint(
  dependencies: AppDependencies,
) {
  return async (): Promise<
    Result<DetectedSourceCandidate[], SourceDetectionTargetEndpointError>
  > => {
    const result =
      await dependencies.sourceDetectionService.listDetectedSourceCandidates();

    if (!result.ok) {
      return err({
        code: "source_detection_candidate_list_failed",
        message: result.error.message,
      });
    }

    return result;
  };
}

export function createDismissDetectedSourceCandidateEndpoint(
  dependencies: AppDependencies,
) {
  return async (
    candidateId: string,
  ): Promise<
    Result<DetectedSourceCandidate, SourceDetectionTargetEndpointError>
  > => {
    const result =
      await dependencies.sourceDetectionService.dismissDetectedSourceCandidate(
        candidateId,
      );

    if (!result.ok) {
      return err({
        code: "source_detection_candidate_dismiss_failed",
        message: result.error.message,
      });
    }

    return result;
  };
}

export function createRegisterDetectedSourceCandidateEndpoint(
  dependencies: AppDependencies,
) {
  return async (
    candidateId: string,
  ): Promise<
    Result<DetectedSourceCandidate, SourceDetectionTargetEndpointError>
  > => {
    const result =
      await dependencies.sourceDetectionService.registerDetectedSourceCandidate(
        candidateId,
      );

    if (!result.ok) {
      return err({
        code: "source_detection_candidate_register_failed",
        message: result.error.message,
      });
    }

    return result;
  };
}
