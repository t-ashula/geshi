import { podcastRssPlugin } from "./collector/podcast-rss/index.js";
import type { SourceCollectorPlugin } from "./types.js";

const sourceCollectorPlugins = new Map<string, SourceCollectorPlugin>([
  ["podcast-rss", podcastRssPlugin],
]);

export interface SourceCollectorRegistry {
  get(pluginSlug: string): SourceCollectorPlugin;
}

export function createSourceCollectorRegistry(
  plugins: Map<string, SourceCollectorPlugin> = sourceCollectorPlugins,
): SourceCollectorRegistry {
  return {
    get(pluginSlug: string): SourceCollectorPlugin {
      const plugin = plugins.get(pluginSlug);

      if (plugin === undefined) {
        throw new Error(`Unknown source collector plugin: ${pluginSlug}`);
      }

      return plugin;
    },
  };
}

export const defaultSourceCollectorRegistry = createSourceCollectorRegistry();

export function getSourceCollectorPlugin(
  pluginSlug: string,
): SourceCollectorPlugin {
  return defaultSourceCollectorRegistry.get(pluginSlug);
}
