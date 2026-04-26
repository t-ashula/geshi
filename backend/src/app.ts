import { Hono } from "hono";

import { registerSourceRoutes } from "./routes/api/v1/sources.js";
import type { SourceService } from "./service/source-service.js";

export function createApp(sourceService: SourceService): Hono {
  const app = new Hono();

  registerSourceRoutes(app, sourceService);

  return app;
}
