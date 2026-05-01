import { Hono } from "hono";

import type { AppDependencies } from "../../../deps.js";
import { createGetJobHandler } from "../../../handlers/api/v1/jobs.js";

export function createJobRoutes(dependencies: AppDependencies): Hono {
  const router = new Hono();

  router.get("/:jobId", createGetJobHandler(dependencies));

  return router;
}
