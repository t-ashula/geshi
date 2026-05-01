import type { AppDependencies } from "../../../deps.js";
import type { JsonEndpointResult } from "../../types.js";

export function createGetPeriodicCrawlSettingsEndpoint(
  dependencies: AppDependencies,
) {
  return async (): Promise<JsonEndpointResult> => {
    const settings =
      await dependencies.appSettingService.getPeriodicCrawlSettings();

    if (!settings.ok) {
      return {
        body: {
          error: {
            code: "periodic_crawl_settings_load_failed",
            message: settings.error.message,
          },
        },
        status: 500,
      };
    }

    return {
      body: {
        data: settings.value,
      },
      status: 200,
    };
  };
}

export function createPatchPeriodicCrawlSettingsEndpoint(
  dependencies: AppDependencies,
) {
  return async (body: unknown): Promise<JsonEndpointResult> => {
    if (body === null || typeof body !== "object") {
      return invalidJsonResult();
    }

    const record = body as Record<string, unknown>;

    if (
      typeof record.enabled !== "boolean" ||
      !isPositiveInteger(record.intervalMinutes)
    ) {
      return {
        body: {
          error: {
            code: "invalid_settings",
            message:
              "Periodic crawl settings require boolean enabled and positive intervalMinutes.",
          },
        },
        status: 422,
      };
    }

    const settings =
      await dependencies.appSettingService.updatePeriodicCrawlSettings({
        enabled: record.enabled,
        intervalMinutes: record.intervalMinutes,
      });

    if (!settings.ok) {
      return {
        body: {
          error: {
            code: "periodic_crawl_settings_update_failed",
            message: settings.error.message,
          },
        },
        status: 500,
      };
    }

    return {
      body: {
        data: settings.value,
      },
      status: 200,
    };
  };
}

export function invalidJsonResult(): JsonEndpointResult {
  return {
    body: {
      error: {
        code: "invalid_json",
        message: "Request body must be a JSON object.",
      },
    },
    status: 400,
  };
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}
