import type {
  AcquiredAsset,
  ExtractedDetailBody,
  SourceCollectorAcquireInput,
  SourceCollectorExtractInput,
  SourceCollectorInspectInput,
  SourceCollectorObserveInput,
  SourceCollectorPlugin,
  SourceCollectorPluginDefinition,
  SourceCollectorSupportsInput,
} from "@geshi/sdk";

import { manifest } from "./manifest.js";

export const plugin: SourceCollectorPlugin = {
  supports(_input: SourceCollectorSupportsInput, _context) {
    return Promise.resolve({
      supported: true,
    });
  },

  settingSchema() {
    return [];
  },

  inspect(input: SourceCollectorInspectInput, _context) {
    return Promise.resolve({
      description:
        "Fixture external plugin for install and generate verification.",
      title: "Example External Feed",
      url: input.sourceUrl,
    });
  },

  observe(_input: SourceCollectorObserveInput, _context) {
    return Promise.resolve({
      contents: [],
    });
  },

  extract(
    _input: SourceCollectorExtractInput,
    _context,
  ): Promise<ExtractedDetailBody | null> {
    return Promise.resolve(null);
  },

  acquire(
    input: SourceCollectorAcquireInput,
    _context,
  ): Promise<AcquiredAsset> {
    return Promise.reject(
      new Error(
        `Example external feed plugin does not acquire assets: ${input.asset.kind}`,
      ),
    );
  },
};

export const definition: SourceCollectorPluginDefinition = {
  manifest,
  plugin,
};
