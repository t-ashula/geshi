import type { PluginManifest } from "@geshi/plugin-api";

export const manifest: PluginManifest = {
  apiVersion: "1",
  capabilities: [
    {
      kind: "source-collector",
      sourceKind: "feed",
    },
  ],
  description:
    "Collect gov-online ministry news updates from the non-RSS HTML source used by go-jp-rss.",
  displayName: "Go JP RSS",
  pluginSlug: "go-jp-rss",
};

export const goJpRssManifest = manifest;
