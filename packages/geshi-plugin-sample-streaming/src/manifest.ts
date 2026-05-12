import type { PluginManifest } from "@geshi/sdk";

export const manifest: PluginManifest = {
  apiVersion: "1",
  capabilities: [
    {
      kind: "source-collector",
      sourceKind: "streaming",
    },
  ],
  description:
    "Collect sample streaming sources served by geshi test fixtures.",
  displayName: "Sample Streaming",
  pluginSlug: "streaming-plugin-example",
};

export const sampleStreamingManifest = manifest;
