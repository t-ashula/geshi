import { Hono } from "hono";

import { registerContentRoutes } from "./routes/api/v1/contents.js";
import { registerJobRoutes } from "./routes/api/v1/jobs.js";
import { registerSourceRoutes } from "./routes/api/v1/sources.js";
import type { ContentService } from "./service/content-service.js";
import type { JobService } from "./service/job-service.js";
import type { SourceService } from "./service/source-service.js";

export function createApp(
  sourceService: SourceService,
  contentService: ContentService,
  jobService: JobService,
): Hono {
  const app = new Hono();

  registerSourceRoutes(app, sourceService, jobService);
  registerContentRoutes(app, contentService);
  registerJobRoutes(app, jobService);

  return app;
}
