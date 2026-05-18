import { describe, expect, it, vi } from "vitest";

import { ok } from "../../src/lib/result.js";
import { createPluginGlobalSettingsService } from "../../src/service/plugin-global-settings-service.js";
import { assertOk } from "../support/result.js";

describe("plugin global settings service", () => {
  it("reads only schema-declared keys from shared plugin state", async () => {
    const service = createPluginGlobalSettingsService({
      pluginGlobalRuntimeStateRepository: {
        findLatestByPluginSlug: vi.fn(() =>
          Promise.resolve(
            ok({
              state: {
                hiddenRuntimeValue: "runtime-only",
                profileName: "main-profile",
              },
              version: 4,
            }),
          ),
        ),
        saveState: vi.fn(),
      } as never,
      sourceCollectorRegistry: {
        get: vi.fn(() => ({
          acquire: vi.fn(),
          globalSettingSchema: vi.fn(() => [
            {
              key: "profileName",
              type: { type: "text" as const },
            },
          ]),
          inspect: vi.fn(),
          observe: vi.fn(),
          extract: vi.fn(),
          settingSchema: vi.fn(() => []),
          supports: vi.fn(),
        })),
        getSourceKind: vi.fn(() => "feed" as const),
        list: vi.fn(() => []),
      },
    });

    const result = await service.getPluginGlobalSettings("go-jp-rss");

    assertOk(result);
    expect(result.value).toEqual({
      baseVersion: 4,
      items: [
        {
          key: "profileName",
          type: { type: "text" },
          value: "main-profile",
        },
      ],
      pluginSlug: "go-jp-rss",
    });
  });

  it("updates only schema-declared keys and preserves runtime-owned values", async () => {
    const saveState = vi.fn(() => Promise.resolve(ok(5)));
    const service = createPluginGlobalSettingsService({
      pluginGlobalRuntimeStateRepository: {
        findLatestByPluginSlug: vi.fn(() =>
          Promise.resolve(
            ok({
              state: {
                hiddenRuntimeValue: "runtime-only",
                profileName: "old-profile",
              },
              version: 4,
            }),
          ),
        ),
        saveState,
      } as never,
      sourceCollectorRegistry: {
        get: vi.fn(() => ({
          acquire: vi.fn(),
          globalSettingSchema: vi.fn(() => [
            {
              key: "profileName",
              type: { type: "text" as const },
            },
          ]),
          inspect: vi.fn(),
          observe: vi.fn(),
          extract: vi.fn(),
          settingSchema: vi.fn(() => []),
          supports: vi.fn(),
        })),
        getSourceKind: vi.fn(() => "feed" as const),
        list: vi.fn(() => []),
      },
    });

    const result = await service.updatePluginGlobalSettings("go-jp-rss", 4, [
      {
        key: "profileName",
        value: "new-profile",
      },
      {
        key: "unknownKey",
        value: "should-be-ignored",
      },
    ]);

    assertOk(result);
    expect(saveState).toHaveBeenCalledWith({
      expectedVersion: 4,
      pluginSlug: "go-jp-rss",
      state: {
        hiddenRuntimeValue: "runtime-only",
        profileName: "new-profile",
      },
    });
    expect(result.value).toEqual({
      baseVersion: 5,
      items: [
        {
          key: "profileName",
          type: { type: "text" },
          value: "new-profile",
        },
      ],
      pluginSlug: "go-jp-rss",
    });
  });
});
