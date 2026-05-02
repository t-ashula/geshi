import { definition as goJpRssPluginDefinition } from "../../../packages/geshi-plugin-go-jp-rss/src/index.js";
import { definition as podcastRssPluginDefinition } from "./collector/podcast-rss/index.js";
import type {
  SourceCollectorPlugin,
  SourceCollectorPluginCapability,
  SourceCollectorPluginDefinition,
  SourceCollectorSourceKind,
} from "./types.js";

type RegisteredSourceCollectorPlugin = {
  capability: SourceCollectorPluginCapability;
  definition: SourceCollectorPluginDefinition;
};

const sourceCollectorPlugins = registerSourceCollectorPlugins([
  goJpRssPluginDefinition,
  podcastRssPluginDefinition,
]);

export interface SourceCollectorRegistry {
  get(pluginSlug: string): SourceCollectorPlugin;
  getSourceKind(pluginSlug: string): SourceCollectorSourceKind;
}

export function createSourceCollectorRegistry(
  plugins: Map<
    string,
    RegisteredSourceCollectorPlugin
  > = sourceCollectorPlugins,
): SourceCollectorRegistry {
  return {
    get(pluginSlug: string): SourceCollectorPlugin {
      const plugin = plugins.get(pluginSlug);

      if (plugin === undefined) {
        throw new Error(`Unknown source collector plugin: ${pluginSlug}`);
      }

      return plugin.definition.plugin;
    },

    getSourceKind(pluginSlug: string): SourceCollectorSourceKind {
      const plugin = plugins.get(pluginSlug);

      if (plugin === undefined) {
        throw new Error(`Unknown source collector plugin: ${pluginSlug}`);
      }

      return plugin.capability.sourceKind;
    },
  };
}

export const defaultSourceCollectorRegistry = createSourceCollectorRegistry();

export function getSourceCollectorPlugin(
  pluginSlug: string,
): SourceCollectorPlugin {
  return defaultSourceCollectorRegistry.get(pluginSlug);
}

function registerSourceCollectorPlugins(
  definitions: SourceCollectorPluginDefinition[],
): Map<string, RegisteredSourceCollectorPlugin> {
  const registeredPlugins = new Map<string, RegisteredSourceCollectorPlugin>();

  for (const definition of definitions) {
    const capability = definition.manifest.capabilities.find(
      (candidate): candidate is SourceCollectorPluginCapability =>
        candidate.kind === "source-collector",
    );

    if (capability === undefined) {
      continue;
    }

    registeredPlugins.set(definition.manifest.pluginSlug, {
      capability,
      definition,
    });
  }

  return registeredPlugins;
}
