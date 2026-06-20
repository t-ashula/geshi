import type { PluginManifest } from "../../types.js";

export const manifest: PluginManifest = {
  apiVersion: "1",
  capabilities: [
    {
      kind: "source-collector",
      sourceKind: "podcast",
    },
  ],
  description: "Collect podcast RSS and Atom feeds.",
  displayName: "Podcast RSS",
  pluginSlug: "podcast-rss",
};

export const podcastRssManifest = manifest;
