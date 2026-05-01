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
    const data = await listContents();

    return context.json({ data });
  });
  router.get("/:contentId", async (context) => {
    const result = await getContentDetail(
      requireRouteParam(context.req.param("contentId"), "contentId"),
    );

    if (!result.ok) {
      return context.json(
        {
          error: {
            code: result.error.code,
            message: result.error.message,
          },
        },
        { status: 404 },
      );
    }

    return context.json({ data: result.value });
  });

  return router;
}

function requireRouteParam(value: string | undefined, name: string): string {
  if (value === undefined) {
    throw new Error(`Missing route param: ${name}`);
  }

  return value;
}
