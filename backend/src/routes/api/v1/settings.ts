import type { Context } from "hono";
import { Hono } from "hono";

import type { AppDependencies } from "../../../deps.js";
import type {
  PatchPeriodicCrawlSettingsInput,
  PatchPluginGlobalSettingsInput,
} from "../../../endpoints/api/v1/settings.js";
import {
  createGetPeriodicCrawlSettingsEndpoint,
  createGetPluginGlobalSettingsEndpoint,
  createPatchPeriodicCrawlSettingsEndpoint,
  createPatchPluginGlobalSettingsEndpoint,
} from "../../../endpoints/api/v1/settings.js";
import type { Result } from "../../../lib/result.js";
import { err, ok } from "../../../lib/result.js";

export function createSettingRoutes(dependencies: AppDependencies): Hono {
  const router = new Hono();
  const getPeriodicCrawlSettings =
    createGetPeriodicCrawlSettingsEndpoint(dependencies);
  const getPluginGlobalSettings =
    createGetPluginGlobalSettingsEndpoint(dependencies);
  const patchPeriodicCrawlSettings =
    createPatchPeriodicCrawlSettingsEndpoint(dependencies);
  const patchPluginGlobalSettings =
    createPatchPluginGlobalSettingsEndpoint(dependencies);

  router.get("/periodic-crawl", async (context) => {
    const result = await getPeriodicCrawlSettings();

    if (!result.ok) {
      return context.json(
        {
          error: {
            code: result.error.code,
            message: result.error.message,
          },
        },
        { status: 500 },
      );
    }

    return context.json({ data: result.value });
  });
  router.patch("/periodic-crawl", async (context) => {
    const json = await readJsonObject(context);

    if (!json.ok) {
      return context.json({ error: json.error }, { status: 400 });
    }

    const input = toPatchPeriodicCrawlSettingsInput(json.value);

    if (!input.ok) {
      return context.json({ error: input.error }, { status: 422 });
    }

    const result = await patchPeriodicCrawlSettings(input.value);

    if (!result.ok) {
      return context.json(
        {
          error: {
            code: result.error.code,
            message: result.error.message,
          },
        },
        { status: 500 },
      );
    }

    return context.json({ data: result.value });
  });
  router.get("/plugins/:pluginSlug", async (context) => {
    const result = await getPluginGlobalSettings(
      requireRouteParam(context.req.param("pluginSlug"), "pluginSlug"),
    );

    if (!result.ok) {
      return context.json(
        {
          error: {
            code: result.error.code,
            message: result.error.message,
          },
        },
        {
          status: result.error.code === "plugin_not_found" ? 404 : 500,
        },
      );
    }

    return context.json({ data: result.value });
  });
  router.patch("/plugins/:pluginSlug", async (context) => {
    const json = await readJsonObject(context);

    if (!json.ok) {
      return context.json({ error: json.error }, { status: 400 });
    }

    const input = toPatchPluginGlobalSettingsInput(json.value);

    if (!input.ok) {
      return context.json({ error: input.error }, { status: 422 });
    }

    const result = await patchPluginGlobalSettings(
      requireRouteParam(context.req.param("pluginSlug"), "pluginSlug"),
      input.value,
    );

    if (!result.ok) {
      return context.json(
        {
          error: {
            code: result.error.code,
            message: result.error.message,
          },
        },
        {
          status:
            result.error.code === "plugin_not_found"
              ? 404
              : result.error.code === "plugin_global_settings_conflict"
                ? 409
                : 500,
        },
      );
    }

    return context.json({ data: result.value });
  });

  return router;
}

function requireRouteParam(value: string | undefined, name: string): string {
  if (value === undefined) {
    throw new Error(`Missing route param: ${name}`);
  }

  return value;
}

async function readJsonObject(
  context: Context,
): Promise<
  Result<Record<string, unknown>, { code: "invalid_json"; message: string }>
> {
  let json: unknown;

  try {
    json = await context.req.json();
  } catch {
    return err({
      code: "invalid_json",
      message: "Request body must be a JSON object.",
    });
  }

  if (json === null || typeof json !== "object") {
    return err({
      code: "invalid_json",
      message: "Request body must be a JSON object.",
    });
  }

  return ok(json as Record<string, unknown>);
}

function toPatchPeriodicCrawlSettingsInput(
  value: Record<string, unknown>,
): Result<
  PatchPeriodicCrawlSettingsInput,
  { code: "invalid_settings"; message: string }
> {
  if (
    typeof value.enabled !== "boolean" ||
    !isPositiveInteger(value.intervalMinutes)
  ) {
    return err({
      code: "invalid_settings",
      message:
        "Periodic crawl settings require boolean enabled and positive intervalMinutes.",
    });
  }

  return ok({
    enabled: value.enabled,
    intervalMinutes: value.intervalMinutes,
  });
}

function toPatchPluginGlobalSettingsInput(
  value: Record<string, unknown>,
): Result<
  PatchPluginGlobalSettingsInput,
  { code: "invalid_plugin_global_settings"; message: string }
> {
  if (
    !("baseVersion" in value) ||
    !isNullablePositiveInteger(value.baseVersion) ||
    !isCollectorSettingItems(value.items)
  ) {
    return err({
      code: "invalid_plugin_global_settings",
      message:
        "Plugin global settings require null or positive baseVersion and valid items.",
    });
  }

  return ok({
    baseVersion: value.baseVersion,
    items: value.items as PatchPluginGlobalSettingsInput["items"],
  });
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isNullablePositiveInteger(value: unknown): value is number | null {
  return value === null || isPositiveInteger(value);
}

function isCollectorSettingItems(value: unknown): value is Array<{
  key: string;
  value: boolean | null | number | string | Array<unknown> | object;
}> {
  return (
    Array.isArray(value) &&
    value.every((item) => {
      if (item === null || typeof item !== "object") {
        return false;
      }

      const candidate = item as Record<string, unknown>;

      return typeof candidate.key === "string" && isJsonValue(candidate.value);
    })
  );
}

function isJsonValue(value: unknown): boolean {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every((entry) => isJsonValue(entry));
  }

  if (typeof value !== "object") {
    return false;
  }

  return Object.values(value).every((entry) => isJsonValue(entry));
}
