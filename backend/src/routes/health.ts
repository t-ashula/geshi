import type { Hono } from "hono";

export function registerHealthRoute(app: Hono): void {
  app.get("/health", (context) => {
    return context.json({ ok: true });
  });
}
