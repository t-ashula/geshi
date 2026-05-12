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
});
