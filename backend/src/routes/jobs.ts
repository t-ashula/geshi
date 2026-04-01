import type { Hono } from "hono";

import { resolveRedisConnection } from "../bullmq/index.js";
import {
  createJobApi,
  createJobRuntime,
  createJobStore,
  JobApiValidationError,
  JobNotFoundError,
} from "../job/index.js";

export function registerJobRoutes(app: Hono): void {
  const redisConnection = resolveRedisConnection();
  const jobApi = createJobApi(
    createJobStore({ kind: "pg" }),
    createJobRuntime({
      kind: "bullmq",
      options: {
        connection: redisConnection,
      },
    }),
  );

  app.post("/jobs", async (context) => {
    try {
      const job = await jobApi.createJob(await context.req.json());

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
      const job = await jobApi.getJob(context.req.param("jobId"));

      return context.json(job);
    } catch (error) {
      if (error instanceof JobNotFoundError) {
        return context.json({ error: error.message }, 404);
      }

      throw error;
    }
  });

  app.get("/jobs", async (context) => {
    const jobs = await jobApi.listJobs();

    return context.json({ jobs });
  });

  app.post("/jobs/:jobId/events", async (context) => {
    try {
      const event = await jobApi.appendJobEvent(
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
