import { Hono } from "hono";

import { registerHealthRoute } from "./routes/health.js";

export function createApp(): Hono {
  const app = new Hono();

  registerHealthRoute(app);

  return app;
}
