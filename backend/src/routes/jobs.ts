import type { Hono } from "hono";

import { createPingQueue } from "../bullmq/index.js";
import { getPool } from "../db/index.js";
import type { JobApi } from "../job/index.js";
import {
  createJobApi as createBackendJobApi,
  JobApiValidationError,
  JobNotFoundError,
} from "../job/index.js";

export function registerJobRoutes(app: Hono): void {
  app.post("/dev/jobs/ping", async (context) => {
    const queue = createPingQueue();

    try {
      const job = await queue.add("ping", {
        requestedAt: new Date().toISOString(),
      });

      return context.json(
        {
          ok: true,
          queue: queue.name,
          jobId: job.id,
        },
        202,
      );
    } finally {
      await queue.close();
    }
  });

  app.post("/jobs", async (context) => {
    try {
      const job = await createJobApi().createJob(await context.req.json());

      return context.json(job, 201);
    } catch (error) {
      if (error instanceof JobApiValidationError) {
        return context.json({ error: error.message }, 400);
      }

      throw error;
    }
  });

  app.get("/jobs/:jobId", async (context) => {
    try {
      const job = await createJobApi().getJob(context.req.param("jobId"));

      return context.json(job);
    } catch (error) {
      if (error instanceof JobNotFoundError) {
        return context.json({ error: error.message }, 404);
      }

      throw error;
    }
  });

  app.get("/jobs", async (context) => {
    const jobs = await createJobApi().listJobs();

    return context.json({ jobs });
  });

  app.post("/jobs/:jobId/events", async (context) => {
    try {
      const event = await createJobApi().appendJobEvent(
        context.req.param("jobId"),
        await context.req.json(),
      );

      return context.json({ event }, 201);
    } catch (error) {
      if (error instanceof JobApiValidationError) {
        return context.json({ error: error.message }, 400);
      }

      if (error instanceof JobNotFoundError) {
        return context.json({ error: error.message }, 404);
      }

      throw error;
    }
  });
}

function createJobApi(): JobApi {
  return createBackendJobApi(getPool());
}
