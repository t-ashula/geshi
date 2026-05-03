import { readFile } from "node:fs/promises";

import type {
  GeneratedSourceCollectorPluginMetadata,
  PluginArtifactPaths,
} from "../../../internal/geshi-config.js";
import type {
  SourceCollectorPluginCapability,
  SourceCollectorPluginDefinition,
  SourceCollectorSourceKind,
} from "./types.js";

export type ExternalSourceCollectorPluginRecord =
  | {
      capability: SourceCollectorPluginCapability;
      definition: SourceCollectorPluginDefinition;
      description: string | null;
      displayName: string;
      message: null;
      packageName: string;
      pluginSlug: string;
      sourceKind: SourceCollectorSourceKind;
      status: "available";
    }
  | {
      description: string | null;
      displayName: string;
      message: string;
      packageName: string;
      pluginSlug: string;
      sourceKind: SourceCollectorSourceKind;
      status: "unavailable";
    };

type GeneratedSourceCollectorPluginLoader = {
  loadDefinition(): Promise<SourceCollectorPluginDefinition>;
  packageName: string;
};

type GeneratedSourceCollectorPluginModule = {
  generatedSourceCollectorPluginLoaders?: GeneratedSourceCollectorPluginLoader[];
};

export async function loadExternalSourceCollectorPlugins(
  pluginArtifactPaths: PluginArtifactPaths,
): Promise<ExternalSourceCollectorPluginRecord[]> {
  const [loaders, metadataEntries] = await Promise.all([
    loadGeneratedSourceCollectorPluginLoaders(
      pluginArtifactPaths.generatedPluginIndexUrl,
    ),
    loadGeneratedSourceCollectorPluginMetadata(
      pluginArtifactPaths.generatedPluginMetadataPath,
    ),
  ]);
  const metadataByPackageName = new Map(
    metadataEntries.map((entry) => [entry.packageName, entry]),
  );
  const records: ExternalSourceCollectorPluginRecord[] = [];

  for (const loader of loaders) {
    const metadata = metadataByPackageName.get(loader.packageName);

    try {
      const definition = await loader.loadDefinition();
      const capability = definition.manifest.capabilities.find(
        (candidate): candidate is SourceCollectorPluginCapability =>
          candidate.kind === "source-collector",
      );

      if (capability === undefined) {
        if (
          metadata !== undefined &&
          metadata.pluginSlug !== null &&
          metadata.sourceKind !== null
        ) {
          records.push({
            description: metadata.description,
            displayName: metadata.displayName,
            message: "Plugin does not expose a source-collector capability.",
            packageName: loader.packageName,
            pluginSlug: metadata.pluginSlug,
            sourceKind: metadata.sourceKind,
            status: "unavailable",
          });
        }

        continue;
      }

      records.push({
        capability,
        definition,
        description: definition.manifest.description ?? null,
        displayName: definition.manifest.displayName,
        message: null,
        packageName: loader.packageName,
        pluginSlug: definition.manifest.pluginSlug,
        sourceKind: capability.sourceKind,
        status: "available",
      });
    } catch (error) {
      if (
        metadata === undefined ||
        metadata.pluginSlug === null ||
        metadata.sourceKind === null
      ) {
        continue;
      }

      records.push({
        description: metadata.description,
        displayName: metadata.displayName,
        message: error instanceof Error ? error.message : "Plugin load failed.",
        packageName: loader.packageName,
        pluginSlug: metadata.pluginSlug,
        sourceKind: metadata.sourceKind,
        status: "unavailable",
      });
    }
  }

  return records;
}

async function loadGeneratedSourceCollectorPluginLoaders(
  generatedPluginIndexUrl: string,
): Promise<GeneratedSourceCollectorPluginLoader[]> {
  try {
    const module = (await import(
      generatedPluginIndexUrl
    )) as GeneratedSourceCollectorPluginModule;

    return module.generatedSourceCollectorPluginLoaders ?? [];
  } catch {
    return [];
  }
}

async function loadGeneratedSourceCollectorPluginMetadata(
  generatedPluginMetadataPath: string,
): Promise<GeneratedSourceCollectorPluginMetadata[]> {
  try {
    const content = await readFile(generatedPluginMetadataPath, "utf8");
    const entries = JSON.parse(
      content,
    ) as GeneratedSourceCollectorPluginMetadata[];

    return entries.filter(
      (entry): entry is GeneratedSourceCollectorPluginMetadata =>
        typeof entry.packageName === "string" &&
        typeof entry.displayName === "string" &&
        (typeof entry.pluginSlug === "string" || entry.pluginSlug === null) &&
        (entry.sourceKind === "feed" ||
          entry.sourceKind === "podcast" ||
          entry.sourceKind === null),
    );
  } catch {
    return [];
  }
}
