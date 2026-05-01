import { Hono } from "hono";

import type { AppDependencies } from "../../../deps.js";
import {
  createGetContentDetailEndpoint,
  createListContentsEndpoint,
} from "../../../endpoints/api/v1/contents.js";

export function createContentRoutes(dependencies: AppDependencies): Hono {
  const router = new Hono();
  const listContents = createListContentsEndpoint(dependencies);
  const getContentDetail = createGetContentDetailEndpoint(dependencies);

  router.get("/", async (context) => {
    const result = await listContents();

    return context.json(result.body, { status: result.status });
  });
  router.get("/:contentId", async (context) => {
    const result = await getContentDetail(
      requireRouteParam(context.req.param("contentId"), "contentId"),
    );

    return context.json(result.body, { status: result.status });
  });

  return router;
}

function requireRouteParam(value: string | undefined, name: string): string {
  if (value === undefined) {
    throw new Error(`Missing route param: ${name}`);
  }

  return value;
}
