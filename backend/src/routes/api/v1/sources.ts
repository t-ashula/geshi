import { Hono } from "hono";

import type { AppDependencies } from "../../../deps.js";
import {
  createCreateSourceEndpoint,
  createEnqueueObserveSourceEndpoint,
  createInspectSourceEndpoint,
  createListSourcesEndpoint,
  createPatchSourceCollectorSettingsEndpoint,
} from "../../../endpoints/api/v1/sources.js";

export function createSourceRoutes(dependencies: AppDependencies): Hono {
  const router = new Hono();
  const listSources = createListSourcesEndpoint(dependencies);
  const createSource = createCreateSourceEndpoint(dependencies);
  const inspectSource = createInspectSourceEndpoint(dependencies);
  const enqueueObserveSource = createEnqueueObserveSourceEndpoint(dependencies);
  const patchSourceCollectorSettings =
    createPatchSourceCollectorSettingsEndpoint(dependencies);

  router.get("/", async (context) => {
    const result = await listSources();

    return context.json(result.body, { status: result.status });
  });
  router.post("/", async (context) => {
    const json: unknown = await context.req.json().catch(() => null);
    const result = await createSource(json);

    return context.json(result.body, { status: result.status });
  });
  router.post("/inspect", async (context) => {
    const json: unknown = await context.req.json().catch(() => null);
    const result = await inspectSource(json);

    return context.json(result.body, { status: result.status });
  });
  router.post("/:sourceId/observe", async (context) => {
    const result = await enqueueObserveSource(
      requireRouteParam(context.req.param("sourceId"), "sourceId"),
    );

    return context.json(result.body, { status: result.status });
  });
  router.patch("/:sourceId/collector-settings", async (context) => {
    const json: unknown = await context.req.json().catch(() => null);
    const result = await patchSourceCollectorSettings(
      requireRouteParam(context.req.param("sourceId"), "sourceId"),
      json,
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
