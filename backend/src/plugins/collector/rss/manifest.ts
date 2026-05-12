import type { PluginManifest } from "../../types.js";

export const manifest: PluginManifest = {
  apiVersion: "1",
  capabilities: [
    {
      kind: "source-collector",
      sourceKind: "feed",
    },
  ],
  description:
    "Collect standard RSS feed entries as HTML pages and enclosures.",
  displayName: "RSS",
  pluginSlug: "rss",
};

export const rssManifest = manifest;
