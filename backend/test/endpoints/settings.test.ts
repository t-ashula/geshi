import { describe, expect, it, vi } from "vitest";

import {
  createGetPeriodicCrawlSettingsEndpoint,
  createGetPluginGlobalSettingsEndpoint,
  createPatchPeriodicCrawlSettingsEndpoint,
  createPatchPluginGlobalSettingsEndpoint,
} from "../../src/endpoints/api/v1/settings.js";
import { ok } from "../../src/lib/result.js";
import type { AppSettingService } from "../../src/service/app-setting-service.js";
import type { PluginGlobalSettingsService } from "../../src/service/plugin-global-settings-service.js";
import { createTestAppDependencies } from "../support/app-dependencies.js";

describe("settings endpoints", () => {
  it("returns current periodic-crawl settings shape", async () => {
    const endpoint = createGetPeriodicCrawlSettingsEndpoint(
      createTestAppDependencies({
        appSettingService: {
          getPeriodicCrawlSettings: vi.fn(() =>
            Promise.resolve(
              ok({
                enabled: true,
                intervalMinutes: 30,
              }),
            ),
          ),
          updatePeriodicCrawlSettings: vi.fn(),
        } as unknown as AppSettingService,
      }),
    );

    await expect(endpoint()).resolves.toEqual(
      ok({
        enabled: true,
        intervalMinutes: 30,
      }),
    );
  });

  it("returns updated settings", async () => {
    const endpoint = createPatchPeriodicCrawlSettingsEndpoint(
      createTestAppDependencies({
        appSettingService: {
          getPeriodicCrawlSettings: vi.fn(),
          updatePeriodicCrawlSettings: vi.fn(() =>
            Promise.resolve(
              ok({
                enabled: true,
                intervalMinutes: 15,
              }),
            ),
          ),
        } as unknown as AppSettingService,
      }),
    );

    await expect(
      endpoint({
        enabled: true,
        intervalMinutes: 15,
      }),
    ).resolves.toEqual(
      ok({
        enabled: true,
        intervalMinutes: 15,
      }),
    );
  });

  it("returns plugin global settings shape", async () => {
    const endpoint = createGetPluginGlobalSettingsEndpoint(
      createTestAppDependencies({
        pluginGlobalSettingsService: {
          getPluginGlobalSettings: vi.fn(() =>
            Promise.resolve(
              ok({
                baseVersion: 4,
                items: [
                  {
                    key: "profileName",
                    type: { type: "text" as const },
                    value: "main-profile",
                  },
                ],
                pluginSlug: "go-jp-rss",
              }),
            ),
          ),
          updatePluginGlobalSettings: vi.fn(),
        } as unknown as PluginGlobalSettingsService,
      }),
    );

    await expect(endpoint("go-jp-rss")).resolves.toEqual(
      ok({
        baseVersion: 4,
        items: [
          {
            key: "profileName",
            type: { type: "text" },
            value: "main-profile",
          },
        ],
        pluginSlug: "go-jp-rss",
      }),
    );
  });

  it("returns updated plugin global settings", async () => {
    const endpoint = createPatchPluginGlobalSettingsEndpoint(
      createTestAppDependencies({
        pluginGlobalSettingsService: {
          getPluginGlobalSettings: vi.fn(),
          updatePluginGlobalSettings: vi.fn(() =>
            Promise.resolve(
              ok({
                baseVersion: 5,
                items: [
                  {
                    key: "profileName",
                    type: { type: "text" as const },
                    value: "new-profile",
                  },
                ],
                pluginSlug: "go-jp-rss",
              }),
            ),
          ),
        } as unknown as PluginGlobalSettingsService,
      }),
    );

    await expect(
      endpoint("go-jp-rss", {
        baseVersion: 4,
        items: [
          {
            key: "profileName",
            value: "new-profile",
          },
        ],
      }),
    ).resolves.toEqual(
      ok({
        baseVersion: 5,
        items: [
          {
            key: "profileName",
            type: { type: "text" },
            value: "new-profile",
          },
        ],
        pluginSlug: "go-jp-rss",
      }),
    );
  });
});
