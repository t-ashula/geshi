import * as fs from "node:fs/promises";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs/promises", async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const original = await importOriginal<typeof import("node:fs/promises")>();

  return {
    ...original,
    access: vi.fn(original.access),
  };
});

import { createNoopLogger } from "../../../backend/src/logger/index.js";
import {
  loadGeshiConfig,
  loadPluginArtifactPaths,
  resolvePluginConfig,
} from "../../../internal/geshi-config.js";

describe("geshi config loader", () => {
  const logger = createNoopLogger();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns an empty config when geshi.config.js is absent", async () => {
    const workingDirectory = await mkdtemp(
      path.join(tmpdir(), "geshi-config-missing-"),
    );

    await expect(
      loadGeshiConfig(workingDirectory, {
        logger,
      }),
    ).resolves.toEqual({});
    const artifactPaths = await loadPluginArtifactPaths(workingDirectory, {
      logger,
    });

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

    await expect(
      loadGeshiConfig(workingDirectory, {
        logger,
      }),
    ).resolves.toEqual({
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

    await expect(
      loadGeshiConfig(workingDirectory, {
        logger,
      }),
    ).rejects.toThrow();
  });

  it("uses the default plugin output path when config is empty", () => {
    expect(resolvePluginConfig({}, "/tmp/example")).toEqual({
      outputRootDir: "/tmp/example/.geshi/generated/plugins",
      packages: {},
    });
  });

  it("logs a warning when geshi.config.js is inaccessible", async () => {
    const workingDirectory = await mkdtemp(
      path.join(tmpdir(), "geshi-config-inaccessible-"),
    );
    const accessError = Object.assign(new Error("permission denied"), {
      code: "EACCES",
    });
    const warnSpy = vi.fn();
    const testLogger = {
      ...createNoopLogger(),
      warn: warnSpy,
    };
    const accessSpy = vi.mocked(fs.access).mockRejectedValueOnce(accessError);

    await expect(
      loadGeshiConfig(workingDirectory, {
        logger: testLogger,
      }),
    ).resolves.toEqual({});

    expect(accessSpy).toHaveBeenCalledWith(
      path.join(workingDirectory, "geshi.config.js"),
    );
    expect(testLogger.warn).toHaveBeenCalledWith(
      "geshi config access failed; falling back to empty config.",
      expect.objectContaining({
        configFilePath: path.join(workingDirectory, "geshi.config.js"),
        errorCode: "EACCES",
      }),
    );
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
