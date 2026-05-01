import type { Context } from "hono";
import { Hono } from "hono";

import type { AppDependencies } from "../../../deps.js";
import type { PatchPeriodicCrawlSettingsInput } from "../../../endpoints/api/v1/settings.js";
import {
  createGetPeriodicCrawlSettingsEndpoint,
  createPatchPeriodicCrawlSettingsEndpoint,
} from "../../../endpoints/api/v1/settings.js";
import type { Result } from "../../../lib/result.js";
import { err, ok } from "../../../lib/result.js";

export function createSettingRoutes(dependencies: AppDependencies): Hono {
  const router = new Hono();
  const getPeriodicCrawlSettings =
    createGetPeriodicCrawlSettingsEndpoint(dependencies);
  const patchPeriodicCrawlSettings =
    createPatchPeriodicCrawlSettingsEndpoint(dependencies);

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

  return router;
}

async function readJsonObject(
  context: Context,
): Promise<
  Result<Record<string, unknown>, { code: "invalid_json"; message: string }>
> {
  const json: unknown = await context.req.json().catch(() => null);

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

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}
