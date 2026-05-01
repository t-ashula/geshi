import { Hono } from "hono";

import type { AppDependencies } from "../../../deps.js";
import { createGetJobEndpoint } from "../../../endpoints/api/v1/jobs.js";

export function createJobRoutes(dependencies: AppDependencies): Hono {
  const router = new Hono();
  const getJob = createGetJobEndpoint(dependencies);

  router.get("/:jobId", async (context) => {
    const result = await getJob(
      requireRouteParam(context.req.param("jobId"), "jobId"),
    );

    return context.json(result.body, { status: result.status });
  });

  return router;
}

function requireRouteParam(value: string | undefined, name: string): string {
  if (value === undefined) {
    throw new Error(`Missing route param: ${name}`);
  }

  return value;
}
