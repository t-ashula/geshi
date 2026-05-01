import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import {
  createGetPeriodicCrawlSettingsHandler,
  createPatchPeriodicCrawlSettingsHandler,
} from "../../src/handlers/api/v1/settings.js";
import { ok } from "../../src/lib/result.js";
import type { AppSettingService } from "../../src/service/app-setting-service.js";
import { createTestAppDependencies } from "../support/app-dependencies.js";

describe("settings handlers", () => {
  it("returns current periodic-crawl settings shape", async () => {
    const handler = createGetPeriodicCrawlSettingsHandler(
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
    const app = new Hono();
    app.get("/periodic-crawl", handler);

    const response = await app.request("/periodic-crawl");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        enabled: true,
        intervalMinutes: 30,
      },
    });
  });

  it("preserves invalid-settings errors", async () => {
    const handler = createPatchPeriodicCrawlSettingsHandler(
      createTestAppDependencies({
        appSettingService: {
          getPeriodicCrawlSettings: vi.fn(),
          updatePeriodicCrawlSettings: vi.fn(),
        } as unknown as AppSettingService,
      }),
    );
    const app = new Hono();
    app.patch("/periodic-crawl", handler);

    const response = await app.request("/periodic-crawl", {
      body: JSON.stringify({
        enabled: true,
        intervalMinutes: 0,
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "PATCH",
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "invalid_settings",
        message:
          "Periodic crawl settings require boolean enabled and positive intervalMinutes.",
      },
    });
  });
});
