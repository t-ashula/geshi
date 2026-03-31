import type { Hono } from "hono";

import { getPool } from "../db/index.js";
import type { JobApi } from "../job/index.js";
import {
  createExportJobQueue,
  createJobApi as createStoreBackedJobApi,
  createJobStore,
  JobApiValidationError,
  JobNotFoundError,
  registerJob,
} from "../job/index.js";

export function registerJobRoutes(app: Hono): void {
  app.post("/jobs", async (context) => {
    const queue = createExportJobQueue();

    try {
      const job = await registerJob(
        createRouteJobApi(),
        queue,
        await context.req.json(),
      );

      return context.json(job, 201);
    } catch (error) {
      if (error instanceof JobApiValidationError) {
        return context.json({ error: error.message }, 400);
      }

      throw error;
    } finally {
      await queue.close();
    }
  });

  app.get("/jobs/:jobId", async (context) => {
    try {
      const job = await createRouteJobApi().getJob(context.req.param("jobId"));

      return context.json(job);
    } catch (error) {
      if (error instanceof JobNotFoundError) {
        return context.json({ error: error.message }, 404);
      }

      throw error;
    }
  });

  app.get("/jobs", async (context) => {
    const jobs = await createRouteJobApi().listJobs();

    return context.json({ jobs });
  });

  app.post("/jobs/:jobId/events", async (context) => {
    try {
      const event = await createRouteJobApi().appendJobEvent(
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

function createRouteJobApi(): JobApi {
  return createStoreBackedJobApi(createJobStore(getPool()));
}
