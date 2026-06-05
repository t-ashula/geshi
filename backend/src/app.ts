import { Hono } from "hono";

import type { AppDependencies } from "./deps.js";
import { createCollectionRoutes } from "./routes/api/v1/collections.js";
import { createContentRoutes } from "./routes/api/v1/contents.js";
import { createJobRoutes } from "./routes/api/v1/jobs.js";
import { createSettingRoutes } from "./routes/api/v1/settings.js";
import { createSourceRoutes } from "./routes/api/v1/sources.js";
import { createSubscriptionRoutes } from "./routes/api/v1/subscriptions.js";
import { createMediaAssetRoutes } from "./routes/media/assets.js";

export function createApp(dependencies: AppDependencies): Hono {
  const app = new Hono();

  app.route("/api/v1/sources", createSourceRoutes(dependencies));
  app.route("/api/v1/collections", createCollectionRoutes(dependencies));
  app.route("/api/v1/subscriptions", createSubscriptionRoutes(dependencies));
  app.route("/api/v1/settings", createSettingRoutes(dependencies));
  app.route("/api/v1/contents", createContentRoutes(dependencies));
  app.route("/api/v1/jobs", createJobRoutes(dependencies));
  app.route("/media/assets", createMediaAssetRoutes(dependencies));

  return app;
}
