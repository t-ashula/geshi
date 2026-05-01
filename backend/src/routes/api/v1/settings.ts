import { Hono } from "hono";

import type { AppDependencies } from "../../../deps.js";
import {
  createGetPeriodicCrawlSettingsHandler,
  createPatchPeriodicCrawlSettingsHandler,
} from "../../../handlers/api/v1/settings.js";

export function createSettingRoutes(dependencies: AppDependencies): Hono {
  const router = new Hono();

  router.get(
    "/periodic-crawl",
    createGetPeriodicCrawlSettingsHandler(dependencies),
  );
  router.patch(
    "/periodic-crawl",
    createPatchPeriodicCrawlSettingsHandler(dependencies),
  );

  return router;
}
