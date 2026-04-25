import type { Hono } from "hono";

import { createCatalogStore } from "../catalog/index.js";

export function registerEntryRoutes(app: Hono): void {
  const catalogStore = createCatalogStore({ kind: "pg" });

  app.get("/entries", async (context) => {
    const entries = await catalogStore.listEntries();

    return context.json({ entries });
  });
}
