import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  type GeneratedSourceCollectorPluginMetadata,
  loadGeshiConfig,
  resolvePluginConfig,
} from "../internal/geshi-config.js";

type InstalledPluginResolution =
  | {
      packageName: string;
      resolvedModuleUrl: string;
      status: "available";
    }
  | {
      message: string;
      packageName: string;
      status: "unavailable";
    };

const projectRootDir = process.cwd();
const geshiConfig = await loadGeshiConfig(projectRootDir);
const pluginConfig = resolvePluginConfig(geshiConfig, projectRootDir);
const pluginOutputRootDir = pluginConfig.outputRootDir;
const pluginPackageJsonPath = path.join(pluginOutputRootDir, "package.json");
const generatedPluginIndexPath = path.join(pluginOutputRootDir, "index.js");
const generatedPluginMetadataPath = path.join(
  pluginOutputRootDir,
  "metadata.json",
);

const [, , command, subcommand] = process.argv;

if (
  command !== "plugins" ||
  (subcommand !== "install" && subcommand !== "generate")
) {
  printUsage();
  process.exitCode = 1;
} else if (subcommand === "install") {
  await installPlugins();
} else {
  await generatePlugins();
}

async function installPlugins(): Promise<void> {
  const packages = normalizeConfiguredPluginPackages(pluginConfig.packages);

  await mkdir(pluginOutputRootDir, { recursive: true });
  await writeFile(
    pluginPackageJsonPath,
    `${JSON.stringify(
      {
        name: "geshi-plugin-runtime",
        private: true,
        type: "module",
        dependencies: packages,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const installResult = spawnSync("npm", ["install"], {
    cwd: pluginOutputRootDir,
    shell: false,
    stdio: "inherit",
  });

  if (installResult.status !== 0) {
    process.exitCode = installResult.status ?? 1;
  }
}

async function generatePlugins(): Promise<void> {
  const packageNames = Object.keys(pluginConfig.packages);
  const previousMetadata = await loadExistingMetadata();
  const installedPluginResolutions =
    resolveInstalledPluginResolutions(packageNames);

  await mkdir(pluginOutputRootDir, { recursive: true });
  await writeFile(
    generatedPluginIndexPath,
    `${renderGeneratedPluginIndex(installedPluginResolutions)}\n`,
    "utf8",
  );

  const nextMetadata = await buildGeneratedPluginMetadata(
    installedPluginResolutions,
    previousMetadata,
  );

  await writeFile(
    generatedPluginMetadataPath,
    `${JSON.stringify(nextMetadata, null, 2)}\n`,
    "utf8",
  );
}

async function buildGeneratedPluginMetadata(
  installedPluginResolutions: InstalledPluginResolution[],
  previousMetadata: GeneratedSourceCollectorPluginMetadata[],
): Promise<GeneratedSourceCollectorPluginMetadata[]> {
  const nextMetadata: GeneratedSourceCollectorPluginMetadata[] = [];

  for (const resolution of installedPluginResolutions) {
    const packageName = resolution.packageName;
    const previousEntry =
      previousMetadata.find((entry) => entry.packageName === packageName) ??
      null;

    if (resolution.status === "unavailable") {
      nextMetadata.push({
        description: previousEntry?.description ?? null,
        displayName: previousEntry?.displayName ?? packageName,
        message: resolution.message,
        packageName,
        pluginSlug: previousEntry?.pluginSlug ?? null,
        sourceKind: previousEntry?.sourceKind ?? null,
        status: "unavailable",
      });
      continue;
    }

    try {
      const pluginModule = await import(resolution.resolvedModuleUrl);

      if (pluginModule.definition === undefined) {
        throw new Error("Plugin module does not export definition.");
      }

      const definition = pluginModule.definition as {
        manifest: {
          capabilities: Array<{
            kind: string;
            sourceKind?: "feed" | "podcast" | "streaming";
          }>;
          description?: string;
          displayName: string;
          pluginSlug: string;
        };
      };
      const capability = definition.manifest.capabilities.find(
        (
          candidate,
        ): candidate is {
          kind: "source-collector";
          sourceKind: "feed" | "podcast" | "streaming";
        } =>
          candidate.kind === "source-collector" &&
          (candidate.sourceKind === "feed" ||
            candidate.sourceKind === "podcast" ||
            candidate.sourceKind === "streaming"),
      );

      if (capability === undefined) {
        nextMetadata.push({
          description: previousEntry?.description ?? null,
          displayName: previousEntry?.displayName ?? packageName,
          message: "Plugin does not expose a source-collector capability.",
          packageName,
          pluginSlug: previousEntry?.pluginSlug ?? null,
          sourceKind: previousEntry?.sourceKind ?? null,
          status: "unavailable",
        });
        continue;
      }

      nextMetadata.push({
        description: definition.manifest.description ?? null,
        displayName: definition.manifest.displayName,
        message: null,
        packageName,
        pluginSlug: definition.manifest.pluginSlug,
        sourceKind: capability.sourceKind,
        status: "available",
      });
    } catch (error) {
      nextMetadata.push({
        description: previousEntry?.description ?? null,
        displayName: previousEntry?.displayName ?? packageName,
        message: error instanceof Error ? error.message : "Plugin load failed.",
        packageName,
        pluginSlug: previousEntry?.pluginSlug ?? null,
        sourceKind: previousEntry?.sourceKind ?? null,
        status: "unavailable",
      });
    }
  }

  return nextMetadata;
}

async function loadExistingMetadata(): Promise<
  GeneratedSourceCollectorPluginMetadata[]
> {
  try {
    const content = await readFile(generatedPluginMetadataPath, "utf8");

    return JSON.parse(content) as GeneratedSourceCollectorPluginMetadata[];
  } catch {
    return [];
  }
}

function resolveInstalledPluginResolutions(
  packageNames: string[],
): InstalledPluginResolution[] {
  const require = createRequire(pathToFileURL(pluginPackageJsonPath).href);
  const installedPackagePaths = loadInstalledPackagePaths();

  return packageNames.map((packageName) => {
    const installedPackagePath = `node_modules/${packageName}`;

    if (!installedPackagePaths.has(installedPackagePath)) {
      return {
        message: "Plugin is not installed under plugin.output/node_modules.",
        packageName,
        status: "unavailable" as const,
      };
    }

    try {
      const resolvedModulePath = require.resolve(packageName);

      return {
        packageName,
        resolvedModuleUrl: pathToFileURL(resolvedModulePath).href,
        status: "available" as const,
      };
    } catch (error) {
      return {
        message:
          error instanceof Error ? error.message : "Plugin is not installed.",
        packageName,
        status: "unavailable" as const,
      };
    }
  });
}

function loadInstalledPackagePaths(): Set<string> {
  try {
    const packageLock = JSON.parse(
      readFileSync(path.join(pluginOutputRootDir, "package-lock.json"), "utf8"),
    ) as {
      packages?: Record<string, unknown>;
    };

    return new Set(Object.keys(packageLock.packages ?? {}));
  } catch {
    return new Set();
  }
}

function renderGeneratedPluginIndex(
  installedPluginResolutions: InstalledPluginResolution[],
): string {
  const loaderItems = installedPluginResolutions
    .filter(
      (
        resolution,
      ): resolution is Extract<
        InstalledPluginResolution,
        { status: "available" }
      > => resolution.status === "available",
    )
    .map(
      (resolution) => `  {
    packageName: ${JSON.stringify(resolution.packageName)},
    async loadDefinition() {
      const pluginModule = await import(${JSON.stringify(
        resolution.resolvedModuleUrl,
      )});
      return pluginModule.definition;
    },
  }`,
    )
    .join(",\n");

  return `export const generatedSourceCollectorPluginLoaders = [
${loaderItems}
];`;
}

function normalizePluginPackageSpec(packageSpec: string): string {
  if (!packageSpec.startsWith("file:")) {
    return packageSpec;
  }

  const filePath = packageSpec.slice("file:".length);

  if (path.isAbsolute(filePath)) {
    return packageSpec;
  }

  const absoluteFilePath = path.resolve(projectRootDir, filePath);
  const relativeFilePathFromPluginRoot = path.relative(
    pluginOutputRootDir,
    absoluteFilePath,
  );

  return `file:${relativeFilePathFromPluginRoot}`;
}

function normalizeConfiguredPluginPackages(
  packages: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(packages).map(([packageName, packageSpec]) => [
      packageName,
      normalizePluginPackageSpec(packageSpec),
    ]),
  );
}

function printUsage(): void {
  process.stderr.write(
    "Usage: geshi plugins install | geshi plugins generate\n",
  );
}
