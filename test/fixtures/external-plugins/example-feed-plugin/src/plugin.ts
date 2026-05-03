import type {
  AcquiredAsset,
  SourceCollectorAcquireInput,
  SourceCollectorInspectInput,
  SourceCollectorObserveInput,
  SourceCollectorPlugin,
  SourceCollectorPluginDefinition,
  SourceCollectorSupportsInput,
} from "@geshi/sdk";

import { manifest } from "./manifest.js";

export const plugin: SourceCollectorPlugin = {
  async supports(_input: SourceCollectorSupportsInput) {
    return {
      supported: true,
    };
  },

  async inspect(input: SourceCollectorInspectInput) {
    return {
      description: "Fixture external plugin for install and generate verification.",
      title: "Example External Feed",
      url: input.sourceUrl,
    };
  },

  async observe(_input: SourceCollectorObserveInput) {
    return {
      contents: [],
    };
  },

  async acquire(input: SourceCollectorAcquireInput): Promise<AcquiredAsset> {
    throw new Error(
      `Example external feed plugin does not acquire assets: ${input.asset.kind}`,
    );
  },
};

export const definition: SourceCollectorPluginDefinition = {
  manifest,
  plugin,
};
