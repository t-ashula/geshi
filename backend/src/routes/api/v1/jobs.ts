import type { Hono } from "hono";

import type { JobService } from "../../../service/job-service.js";

type App = Hono;

export function registerJobRoutes(app: App, jobService: JobService): void {
  app.get("/api/v1/jobs/:jobId", async (context) => {
    const result = await jobService.findJobById(context.req.param("jobId"));

    if (!result.ok) {
      return context.json(
        {
          error: {
            code: result.error.code,
            message: result.error.message,
          },
        },
        404,
      );
    }

    return context.json({
      data: result.value,
    });
  });
}
