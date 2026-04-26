import type { Hono } from "hono";

import type { JobService } from "../../../service/job-service.js";

type App = Hono;

export function registerJobRoutes(app: App, jobService: JobService): void {
  app.get("/api/v1/jobs/:jobId", async (context) => {
    const job = await jobService.findJobById(context.req.param("jobId"));

    if (job === null) {
      return context.json(
        {
          error: {
            code: "job_not_found",
            message: "Job not found.",
          },
        },
        404,
      );
    }

    return context.json({
      data: job,
    });
  });
}
