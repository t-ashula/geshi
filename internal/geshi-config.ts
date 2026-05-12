import path from "node:path";
import * as fs from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { createLogger, type Logger } from "../backend/src/logger/index.js";

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
  sourceKind: "feed" | "podcast" | "streaming" | null;
  status: "available" | "unavailable";
};

type GeshiConfigLoaderDependencies = {
  logger: Logger;
};

export async function loadGeshiConfig(
  currentWorkingDirectory: string = process.cwd(),
  dependencies: GeshiConfigLoaderDependencies,
): Promise<GeshiConfig> {
  const configFilePath = path.join(currentWorkingDirectory, "geshi.config.js");

  try {
    await fs.access(configFilePath);
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return {};
    }

    const message = error instanceof Error ? error.message : String(error);
    dependencies.logger.warn(
      "geshi config access failed; falling back to empty config.",
      {
        configFilePath,
        errorCode:
          error instanceof Error && "code" in error ? error.code : undefined,
        errorMessage: message,
      },
    );
    return {};
  }

  const configModule = await import(pathToFileURL(configFilePath).href);

  return (configModule.default ?? {}) as GeshiConfig;
}

function isNodeErrorWithCode(
  error: unknown,
  code: string,
): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string" &&
    error.code === code
  );
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
  dependencies: GeshiConfigLoaderDependencies,
): Promise<PluginArtifactPaths> {
  const config = await loadGeshiConfig(currentWorkingDirectory, dependencies);
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
