import type { PluginGlobalRuntimeStateStore } from "../db/plugin-global-runtime-state-repository.js";
import { PluginGlobalRuntimeStateVersionConflictError } from "../db/plugin-global-runtime-state-repository.js";
import type { PluginGlobalRuntimeStateHost } from "./types.js";

export function createPluginGlobalRuntimeStateHost(
  repository: PluginGlobalRuntimeStateStore,
  pluginSlug: string,
): PluginGlobalRuntimeStateHost {
  return {
    async load() {
      const result = await repository.findLatestByPluginSlug(pluginSlug);

      if (!result.ok) {
        throw result.error;
      }

      return result.value;
    },
    async save(input) {
      const result = await repository.saveState({
        expectedVersion: input.expectedVersion,
        pluginSlug,
        state: input.state,
      });

      if (!result.ok) {
        if (
          result.error instanceof PluginGlobalRuntimeStateVersionConflictError
        ) {
          return {
            ok: false,
            reason: "conflict" as const,
          };
        }

        throw result.error;
      }

      return {
        ok: true,
        version: result.value,
      };
    },
  };
}
