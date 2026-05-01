import { Hono } from "hono";

import type { AppDependencies } from "../../../deps.js";
import {
  createGetPeriodicCrawlSettingsEndpoint,
  createPatchPeriodicCrawlSettingsEndpoint,
} from "../../../endpoints/api/v1/settings.js";

export function createSettingRoutes(dependencies: AppDependencies): Hono {
  const router = new Hono();
  const getPeriodicCrawlSettings =
    createGetPeriodicCrawlSettingsEndpoint(dependencies);
  const patchPeriodicCrawlSettings =
    createPatchPeriodicCrawlSettingsEndpoint(dependencies);

  router.get("/periodic-crawl", async (context) => {
    const result = await getPeriodicCrawlSettings();

    return context.json(result.body, { status: result.status });
  });
  router.patch("/periodic-crawl", async (context) => {
    const json: unknown = await context.req.json().catch(() => null);
    const result = await patchPeriodicCrawlSettings(json);

    return context.json(result.body, { status: result.status });
  });

  return router;
}
