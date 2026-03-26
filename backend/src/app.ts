import { Hono } from "hono";

import {
  registerDashboardRoute,
  registerHealthRoute,
  registerJobRoutes,
} from "./routes/index.js";

export function createApp(): Hono {
  const app = new Hono();

  registerHealthRoute(app);
  registerJobRoutes(app);
  registerDashboardRoute(app);

  return app;
}
