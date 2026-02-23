import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { HonoAdapter } from "@bull-board/hono";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { queues } from "./bull";

(async () => {
  const app = new Hono();
  const serverAdapter = new HonoAdapter(serveStatic);
  createBullBoard({
    queues: Object.values(queues).map((q) => new BullMQAdapter(q)),
    serverAdapter,
  });
  const basePath = "/ui";
  serverAdapter.setBasePath(basePath);
  app.route(basePath, serverAdapter.registerPlugin());
  // showRoutes(app);
  serve({ fetch: app.fetch, port: 4000 }, ({ address, port }) => {
    /* eslint-disable no-console */
    console.log(`Running on ${address}:${port}...`);
    console.log(`For the UI of instance1, open http://localhost:${port}/ui`);
    /* eslint-enable */
  });
})();
