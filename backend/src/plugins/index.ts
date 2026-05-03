import { definition as podcastRssPluginDefinition } from "./collector/podcast-rss/index.js";
import { loadExternalSourceCollectorPlugins } from "./generated.js";
import type {
  SourceCollectorPlugin,
  SourceCollectorPluginCapability,
  SourceCollectorPluginDefinition,
  SourceCollectorSourceKind,
} from "./types.js";
import { loadPluginArtifactPaths } from "../../../internal/geshi-config.js";

export type RegisteredSourceCollectorPlugin =
  | {
      capability: SourceCollectorPluginCapability;
      definition: SourceCollectorPluginDefinition;
      description: string | null;
      displayName: string;
      message: null;
      packageName: string | null;
      pluginSlug: string;
      sourceKind: SourceCollectorSourceKind;
      status: "available";
    }
  | {
      description: string | null;
      displayName: string;
      message: string;
      packageName: string | null;
      pluginSlug: string;
      sourceKind: SourceCollectorSourceKind;
      status: "unavailable";
    };

export class SourceCollectorPluginUnavailableError extends Error {
  readonly pluginSlug: string;

  constructor(pluginSlug: string, message: string) {
    super(message);
    this.name = "SourceCollectorPluginUnavailableError";
    this.pluginSlug = pluginSlug;
  }
}

const sourceCollectorPlugins = await loadDefaultSourceCollectorPlugins();

export interface SourceCollectorRegistry {
  get(pluginSlug: string): SourceCollectorPlugin;
  list(): RegisteredSourceCollectorPlugin[];
  getSourceKind(pluginSlug: string): SourceCollectorSourceKind;
}

export function createSourceCollectorRegistry(
  plugins: Map<
    string,
    RegisteredSourceCollectorPlugin
  > = sourceCollectorPlugins,
): SourceCollectorRegistry {
  return {
    get(pluginSlug: string): SourceCollectorPlugin {
      const plugin = plugins.get(pluginSlug);

      if (plugin === undefined) {
        throw new Error(`Unknown source collector plugin: ${pluginSlug}`);
      }

      if (plugin.status === "unavailable") {
        throw new SourceCollectorPluginUnavailableError(
          pluginSlug,
          plugin.message,
        );
      }

      return plugin.definition.plugin;
    },

    list(): RegisteredSourceCollectorPlugin[] {
      return [...plugins.values()];
    },

    getSourceKind(pluginSlug: string): SourceCollectorSourceKind {
      const plugin = plugins.get(pluginSlug);

      if (plugin === undefined) {
        throw new Error(`Unknown source collector plugin: ${pluginSlug}`);
      }

      if (plugin.status === "unavailable") {
        throw new SourceCollectorPluginUnavailableError(
          pluginSlug,
          plugin.message,
        );
      }

      return plugin.sourceKind;
    },
  };
}

export const defaultSourceCollectorRegistry = createSourceCollectorRegistry();

export function getSourceCollectorPlugin(
  pluginSlug: string,
): SourceCollectorPlugin {
  return defaultSourceCollectorRegistry.get(pluginSlug);
}

function registerSourceCollectorPlugins(
  definitions: SourceCollectorPluginDefinition[],
): Map<string, RegisteredSourceCollectorPlugin> {
  const registeredPlugins = new Map<string, RegisteredSourceCollectorPlugin>();

  for (const definition of definitions) {
    const capability = definition.manifest.capabilities.find(
      (candidate): candidate is SourceCollectorPluginCapability =>
        candidate.kind === "source-collector",
    );

    if (capability === undefined) {
      continue;
    }

    setRegisteredPlugin(registeredPlugins, definition.manifest.pluginSlug, {
      capability,
      definition,
      description: definition.manifest.description ?? null,
      displayName: definition.manifest.displayName,
      message: null,
      packageName: null,
      pluginSlug: definition.manifest.pluginSlug,
      sourceKind: capability.sourceKind,
      status: "available",
    });
  }

  return registeredPlugins;
}

async function loadDefaultSourceCollectorPlugins(): Promise<
  Map<string, RegisteredSourceCollectorPlugin>
> {
  const registeredPlugins = registerSourceCollectorPlugins([
    podcastRssPluginDefinition,
  ]);
  const pluginArtifactPaths = await loadPluginArtifactPaths();
  const externalPlugins = await loadExternalSourceCollectorPlugins(
    pluginArtifactPaths,
  );

  for (const plugin of externalPlugins) {
    setRegisteredPlugin(registeredPlugins, plugin.pluginSlug, plugin);
  }

  return registeredPlugins;
}

function setRegisteredPlugin(
  plugins: Map<string, RegisteredSourceCollectorPlugin>,
  pluginSlug: string,
  plugin: RegisteredSourceCollectorPlugin,
): void {
  if (plugins.has(pluginSlug)) {
    throw new Error(`Duplicate source collector plugin: ${pluginSlug}`);
  }

  plugins.set(pluginSlug, plugin);
}
