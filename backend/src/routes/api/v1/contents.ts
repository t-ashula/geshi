import type { Hono } from "hono";

import type { ContentService } from "../../../service/content-service.js";

type App = Hono;

export function registerContentRoutes(
  app: App,
  contentService: ContentService,
): void {
  app.get("/api/v1/contents", async (context) => {
    const contents = await contentService.listContents();

    return context.json({
      data: contents,
    });
  });
}
