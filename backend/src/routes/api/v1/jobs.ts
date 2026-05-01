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

    if (!result.ok) {
      return context.json(
        {
          error: {
            code: result.error.code,
            message: result.error.message,
          },
        },
        { status: 404 },
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
