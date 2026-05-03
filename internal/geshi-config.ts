import path from "node:path";
import { pathToFileURL } from "node:url";

export type GeshiConfig = {
  plugin?: {
    output?: string;
    packages?: Record<string, string>;
  };
};

export type ResolvedPluginConfig = {
  outputRootDir: string;
  packages: Record<string, string>;
};

export type PluginArtifactPaths = {
  generatedPluginIndexUrl: string;
  generatedPluginMetadataPath: string;
};

export type GeneratedSourceCollectorPluginMetadata = {
  description: string | null;
  displayName: string;
  message: string | null;
  packageName: string;
  pluginSlug: string | null;
  sourceKind: "feed" | "podcast" | null;
  status: "available" | "unavailable";
};

export async function loadGeshiConfig(
  currentWorkingDirectory: string = process.cwd(),
): Promise<GeshiConfig> {
  const configFilePath = path.join(currentWorkingDirectory, "geshi.config.js");
  const configModule = await import(pathToFileURL(configFilePath).href);

  return (configModule.default ?? {}) as GeshiConfig;
}

export function resolvePluginConfig(
  config: GeshiConfig,
  currentWorkingDirectory: string = process.cwd(),
): ResolvedPluginConfig {
  const packages = config.plugin?.packages;
  const output = config.plugin?.output;

  return {
    outputRootDir: path.resolve(
      currentWorkingDirectory,
      typeof output === "string" && output.trim() !== ""
        ? output
        : ".geshi/generated/plugins/",
    ),
    packages:
      packages !== undefined &&
      typeof packages === "object" &&
      packages !== null
        ? (Object.fromEntries(
            Object.entries(packages).filter(
              ([packageName, packageSpec]) =>
                typeof packageName === "string" &&
                typeof packageSpec === "string",
            ),
          ) as Record<string, string>)
        : {},
  };
}

export async function loadPluginArtifactPaths(
  currentWorkingDirectory: string = process.cwd(),
): Promise<PluginArtifactPaths> {
  const config = await loadGeshiConfig(currentWorkingDirectory);
  const pluginConfig = resolvePluginConfig(config, currentWorkingDirectory);

  return {
    generatedPluginIndexUrl: pathToFileURL(
      path.join(pluginConfig.outputRootDir, "index.js"),
    ).href,
    generatedPluginMetadataPath: path.join(
      pluginConfig.outputRootDir,
      "metadata.json",
    ),
  };
}
