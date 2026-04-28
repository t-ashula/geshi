import { podcastRssPlugin } from "./collector/podcast-rss/index.js";
import type { SourceCollectorPlugin } from "./types.js";

const sourceCollectorPlugins = new Map<string, SourceCollectorPlugin>([
  ["podcast-rss", podcastRssPlugin],
]);

export function getSourceCollectorPlugin(
  pluginSlug: string,
): SourceCollectorPlugin {
  const plugin = sourceCollectorPlugins.get(pluginSlug);

  if (plugin === undefined) {
    throw new Error(`Unknown source collector plugin: ${pluginSlug}`);
  }

  return plugin;
}
