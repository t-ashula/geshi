import { describe, expect, it, vi } from "vitest";

import {
  createGetPeriodicCrawlSettingsEndpoint,
  createPatchPeriodicCrawlSettingsEndpoint,
} from "../../src/endpoints/api/v1/settings.js";
import { ok } from "../../src/lib/result.js";
import type { AppSettingService } from "../../src/service/app-setting-service.js";
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

    await expect(endpoint()).resolves.toEqual({
      body: {
        data: {
          enabled: true,
          intervalMinutes: 30,
        },
      },
      status: 200,
    });
  });

  it("preserves invalid-settings errors", async () => {
    const endpoint = createPatchPeriodicCrawlSettingsEndpoint(
      createTestAppDependencies({
        appSettingService: {
          getPeriodicCrawlSettings: vi.fn(),
          updatePeriodicCrawlSettings: vi.fn(),
        } as unknown as AppSettingService,
      }),
    );

    await expect(
      endpoint({
        enabled: true,
        intervalMinutes: 0,
      }),
    ).resolves.toEqual({
      body: {
        error: {
          code: "invalid_settings",
          message:
            "Periodic crawl settings require boolean enabled and positive intervalMinutes.",
        },
      },
      status: 422,
    });
  });
});
