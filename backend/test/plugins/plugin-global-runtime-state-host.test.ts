import { describe, expect, it, vi } from "vitest";

import type { PluginGlobalRuntimeStateStore } from "../../src/db/plugin-global-runtime-state-repository.js";
import { PluginGlobalRuntimeStateVersionConflictError } from "../../src/db/plugin-global-runtime-state-repository.js";
import { err, ok } from "../../src/lib/result.js";
import { createPluginGlobalRuntimeStateHost } from "../../src/plugins/plugin-global-runtime-state-host.js";

type PluginGlobalRuntimeStateRepositoryMock = Pick<
  PluginGlobalRuntimeStateStore,
  "findLatestByPluginSlug" | "saveState"
>;

describe("plugin global runtime state host", () => {
  it("loads state for the bound plugin slug", async () => {
    const repository: PluginGlobalRuntimeStateRepositoryMock = {
      findLatestByPluginSlug: vi.fn(() =>
        Promise.resolve(
          ok({
            state: {
              cookieJarVersion: 2,
            },
            version: 7,
          }),
        ),
      ),
      saveState: vi.fn(),
    };

    const host = createPluginGlobalRuntimeStateHost(repository, "spo");
    const snapshot = await host.load();

    expect(snapshot).toEqual({
      state: {
        cookieJarVersion: 2,
      },
      version: 7,
    });
    expect(repository.findLatestByPluginSlug).toHaveBeenCalledWith("spo");
  });

  it("saves state for the bound plugin slug", async () => {
    const repository: PluginGlobalRuntimeStateRepositoryMock = {
      findLatestByPluginSlug: vi.fn(),
      saveState: vi.fn(() => Promise.resolve(ok(3))),
    };

    const host = createPluginGlobalRuntimeStateHost(repository, "spo");
    const result = await host.save({
      expectedVersion: 2,
      state: {
        sessionId: "abc",
      },
    });

    expect(result).toEqual({
      ok: true,
      version: 3,
    });
    expect(repository.saveState).toHaveBeenCalledWith({
      expectedVersion: 2,
      pluginSlug: "spo",
      state: {
        sessionId: "abc",
      },
    });
  });

  it("maps repository version conflicts to conflict results", async () => {
    const repository: PluginGlobalRuntimeStateRepositoryMock = {
      findLatestByPluginSlug: vi.fn(),
      saveState: vi.fn(() =>
        Promise.resolve(
          err(new PluginGlobalRuntimeStateVersionConflictError("spo")),
        ),
      ),
    };

    const host = createPluginGlobalRuntimeStateHost(repository, "spo");
    const result = await host.save({
      expectedVersion: 2,
      state: {
        sessionId: "abc",
      },
    });

    expect(result).toEqual({
      ok: false,
      reason: "conflict",
    });
  });
});
