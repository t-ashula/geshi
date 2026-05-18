import type { PluginGlobalRuntimeStateRepository } from "../db/plugin-global-runtime-state-repository.js";
import type { PluginGlobalRuntimeStateVersionConflictError } from "../db/plugin-global-runtime-state-repository.js";
import type { Result } from "../lib/result.js";
import { err, ok } from "../lib/result.js";
import type { SourceCollectorRegistry } from "../plugins/index.js";
import { defaultSourceCollectorRegistry } from "../plugins/index.js";
import type {
  JsonObject,
  SourceCollectorPlugin,
  SourceCollectorSettingSchemaField,
  SourceCollectorSettingValue,
} from "../plugins/types.js";

export type PluginGlobalSettingItem = {
  key: string;
  type: SourceCollectorSettingSchemaField["type"];
  value: SourceCollectorSettingValue;
};

export type PluginGlobalSettingsDetail = {
  baseVersion: number | null;
  items: PluginGlobalSettingItem[];
  pluginSlug: string;
};

export type GetPluginGlobalSettingsError = {
  code: "plugin_not_found";
  message: string;
};

export type UpdatePluginGlobalSettingsError = {
  code: "plugin_not_found";
  message: string;
};

export interface PluginGlobalSettingsService {
  getPluginGlobalSettings(
    pluginSlug: string,
  ): Promise<
    Result<PluginGlobalSettingsDetail, GetPluginGlobalSettingsError | Error>
  >;
  updatePluginGlobalSettings(
    pluginSlug: string,
    baseVersion: number | null,
    items: Array<{ key: string; value: SourceCollectorSettingValue }>,
  ): Promise<
    Result<
      PluginGlobalSettingsDetail,
      | UpdatePluginGlobalSettingsError
      | PluginGlobalRuntimeStateVersionConflictError
      | Error
    >
  >;
}

export type CreatePluginGlobalSettingsServiceDependencies = {
  pluginGlobalRuntimeStateRepository: PluginGlobalRuntimeStateRepository;
  sourceCollectorRegistry?: SourceCollectorRegistry;
};

export function createPluginGlobalSettingsService(
  dependencies: CreatePluginGlobalSettingsServiceDependencies,
): PluginGlobalSettingsService {
  const sourceCollectorRegistry =
    dependencies.sourceCollectorRegistry ?? defaultSourceCollectorRegistry;

  return {
    async getPluginGlobalSettings(pluginSlug) {
      const plugin = tryGetPlugin(sourceCollectorRegistry, pluginSlug);

      if (!plugin.ok) {
        return plugin;
      }

      const stateResult =
        await dependencies.pluginGlobalRuntimeStateRepository.findLatestByPluginSlug(
          pluginSlug,
        );

      if (!stateResult.ok) {
        return stateResult;
      }

      const schema = await Promise.resolve(
        plugin.value.globalSettingSchema?.() ?? [],
      );

      return ok({
        baseVersion: stateResult.value.version,
        items: schema.map((field) => ({
          key: field.key,
          type: field.type,
          value: readSettingValue(stateResult.value.state, field.key),
        })),
        pluginSlug,
      });
    },

    async updatePluginGlobalSettings(pluginSlug, baseVersion, items) {
      const plugin = tryGetPlugin(sourceCollectorRegistry, pluginSlug);

      if (!plugin.ok) {
        return plugin;
      }

      const stateResult =
        await dependencies.pluginGlobalRuntimeStateRepository.findLatestByPluginSlug(
          pluginSlug,
        );

      if (!stateResult.ok) {
        return stateResult;
      }

      const schema = await Promise.resolve(
        plugin.value.globalSettingSchema?.() ?? [],
      );
      const allowedKeys = new Set(schema.map((field) => field.key));
      const nextState: JsonObject = {
        ...(stateResult.value.state ?? {}),
      };

      for (const item of items) {
        if (!allowedKeys.has(item.key)) {
          continue;
        }

        nextState[item.key] = item.value;
      }

      const saveResult =
        await dependencies.pluginGlobalRuntimeStateRepository.saveState({
          expectedVersion: baseVersion,
          pluginSlug,
          state: nextState,
        });

      if (!saveResult.ok) {
        return saveResult;
      }

      return ok({
        baseVersion: saveResult.value,
        items: schema.map((field) => ({
          key: field.key,
          type: field.type,
          value: readSettingValue(nextState, field.key),
        })),
        pluginSlug,
      });
    },
  };
}

function tryGetPlugin(
  sourceCollectorRegistry: SourceCollectorRegistry,
  pluginSlug: string,
): Result<SourceCollectorPlugin, GetPluginGlobalSettingsError> {
  try {
    return ok(sourceCollectorRegistry.get(pluginSlug));
  } catch {
    return err({
      code: "plugin_not_found",
      message: "Plugin not found.",
    });
  }
}

function readSettingValue(
  state: JsonObject | undefined,
  key: string,
): SourceCollectorSettingValue {
  const candidate = state?.[key];
  return candidate === undefined ? null : candidate;
}
