import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  loadGeshiConfig,
  loadPluginArtifactPaths,
  resolvePluginConfig,
} from "../../../internal/geshi-config.js";

describe("geshi config loader", () => {
  it("returns an empty config when geshi.config.js is absent", async () => {
    const workingDirectory = await mkdtemp(
      path.join(tmpdir(), "geshi-config-missing-"),
    );

    await expect(loadGeshiConfig(workingDirectory)).resolves.toEqual({});
    const artifactPaths = await loadPluginArtifactPaths(workingDirectory);

    expect(artifactPaths.generatedPluginIndexUrl).toContain(
      "/.geshi/generated/plugins/index.js",
    );
    expect(artifactPaths.generatedPluginMetadataPath).toBe(
      path.join(workingDirectory, ".geshi/generated/plugins/metadata.json"),
    );
  });

  it("loads plugin package settings when geshi.config.js exists", async () => {
    const workingDirectory = await mkdtemp(
      path.join(tmpdir(), "geshi-config-present-"),
    );

    await writeFile(
      path.join(workingDirectory, "geshi.config.js"),
      `export default {
  plugin: {
    output: "./tmp/plugins",
    packages: {
      "@example/plugin": "file:../plugins/example"
    }
  }
};
`,
      "utf8",
    );

    await expect(loadGeshiConfig(workingDirectory)).resolves.toEqual({
      plugin: {
        output: "./tmp/plugins",
        packages: {
          "@example/plugin": "file:../plugins/example",
        },
      },
    });
  });

  it("keeps config import failures when the file exists but is invalid", async () => {
    const workingDirectory = await mkdtemp(
      path.join(tmpdir(), "geshi-config-invalid-"),
    );
    await mkdir(path.join(workingDirectory, "plugins"));
    await writeFile(
      path.join(workingDirectory, "geshi.config.js"),
      `import "./plugins/missing.js";

export default {};
`,
      "utf8",
    );

    await expect(loadGeshiConfig(workingDirectory)).rejects.toThrow();
  });

  it("uses the default plugin output path when config is empty", () => {
    expect(resolvePluginConfig({}, "/tmp/example")).toEqual({
      outputRootDir: "/tmp/example/.geshi/generated/plugins",
      packages: {},
    });
  });
});
