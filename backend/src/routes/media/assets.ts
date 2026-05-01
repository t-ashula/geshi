import { Hono } from "hono";

import type { AppDependencies } from "../../deps.js";
import { createGetMediaAssetHandler } from "../../handlers/media/assets.js";

export function createMediaAssetRoutes(dependencies: AppDependencies): Hono {
  const router = new Hono();

  router.get(
    "/:assetIdWithExtension",
    createGetMediaAssetHandler(dependencies),
  );

  return router;
}
