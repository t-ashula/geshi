import type { PluginManifest } from "@geshi/sdk";

export const manifest: PluginManifest = {
  apiVersion: "1",
  capabilities: [
    {
      kind: "source-collector",
      sourceKind: "podcast",
    },
  ],
  description:
    "Collect publicly available episodes from Onsen program pages as podcast-like audio archives.",
  displayName: "音泉",
  pluginSlug: "radio-onsen",
};

export const onsenManifest = manifest;
