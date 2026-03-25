import { Hono } from "hono";

import { registerDashboardRoute } from "./routes/dashboard.js";
import { registerHealthRoute } from "./routes/health.js";
import { registerJobRoutes } from "./routes/jobs.js";

export function createApp(): Hono {
  const app = new Hono();

  registerHealthRoute(app);
  registerJobRoutes(app);
  registerDashboardRoute(app);

  return app;
}
