import type { Hono } from "hono";

import type { AppSettingService } from "../../../service/app-setting-service.js";

type App = Hono;

export function registerSettingRoutes(
  app: App,
  appSettingService: AppSettingService,
): void {
  app.get("/api/v1/settings/periodic-crawl", async (context) => {
    const settings = await appSettingService.getPeriodicCrawlSettings();

    if (!settings.ok) {
      return context.json(
        {
          error: {
            code: "periodic_crawl_settings_load_failed",
            message: settings.error.message,
          },
        },
        500,
      );
    }

    return context.json({
      data: settings.value,
    });
  });

  app.patch("/api/v1/settings/periodic-crawl", async (context) => {
    const json: unknown = await context.req.json().catch(() => null);

    if (json === null || typeof json !== "object") {
      return context.json(
        {
          error: {
            code: "invalid_json",
            message: "Request body must be a JSON object.",
          },
        },
        400,
      );
    }

    const body = json as Record<string, unknown>;

    if (
      typeof body.enabled !== "boolean" ||
      !isPositiveInteger(body.intervalMinutes)
    ) {
      return context.json(
        {
          error: {
            code: "invalid_settings",
            message:
              "Periodic crawl settings require boolean enabled and positive intervalMinutes.",
          },
        },
        422,
      );
    }

    const settings = await appSettingService.updatePeriodicCrawlSettings({
      enabled: body.enabled,
      intervalMinutes: body.intervalMinutes,
    });

    if (!settings.ok) {
      return context.json(
        {
          error: {
            code: "periodic_crawl_settings_update_failed",
            message: settings.error.message,
          },
        },
        500,
      );
    }

    return context.json({
      data: settings.value,
    });
  });
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}
