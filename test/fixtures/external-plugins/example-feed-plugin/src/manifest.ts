import type { PluginManifest } from "@geshi/sdk";

export const manifest: PluginManifest = {
  apiVersion: "1",
  capabilities: [
    {
      kind: "source-collector",
      sourceKind: "feed",
    },
  ],
  description: "Fixture external plugin for install and generate verification.",
  displayName: "Example External Feed",
  pluginSlug: "example-external-feed",
};
