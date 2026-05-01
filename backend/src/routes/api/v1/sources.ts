import { Hono } from "hono";

import type { AppDependencies } from "../../../deps.js";
import {
  createCreateSourceHandler,
  createEnqueueObserveSourceHandler,
  createInspectSourceHandler,
  createListSourcesHandler,
  createPatchSourceCollectorSettingsHandler,
} from "../../../handlers/api/v1/sources.js";

export function createSourceRoutes(dependencies: AppDependencies): Hono {
  const router = new Hono();

  router.get("/", createListSourcesHandler(dependencies));
  router.post("/", createCreateSourceHandler(dependencies));
  router.post("/inspect", createInspectSourceHandler(dependencies));
  router.post(
    "/:sourceId/observe",
    createEnqueueObserveSourceHandler(dependencies),
  );
  router.patch(
    "/:sourceId/collector-settings",
    createPatchSourceCollectorSettingsHandler(dependencies),
  );

  return router;
}
