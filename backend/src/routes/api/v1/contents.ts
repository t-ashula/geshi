import { Hono } from "hono";

import type { AppDependencies } from "../../../deps.js";
import {
  createGetContentDetailHandler,
  createListContentsHandler,
} from "../../../handlers/api/v1/contents.js";

export function createContentRoutes(dependencies: AppDependencies): Hono {
  const router = new Hono();

  router.get("/", createListContentsHandler(dependencies));
  router.get("/:contentId", createGetContentDetailHandler(dependencies));

  return router;
}
