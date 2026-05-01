import type { Context } from "hono";
import { Hono } from "hono";

import type { AppDependencies } from "../../../deps.js";
import type {
  CreateSourceEndpointInput,
  InspectSourceEndpointInput,
  PatchSourceCollectorSettingsEndpointInput,
} from "../../../endpoints/api/v1/sources.js";
import {
  createCreateSourceEndpoint,
  createEnqueueObserveSourceEndpoint,
  createInspectSourceEndpoint,
  createListSourcesEndpoint,
  createPatchSourceCollectorSettingsEndpoint,
} from "../../../endpoints/api/v1/sources.js";
import type { Result } from "../../../lib/result.js";
import { err, ok } from "../../../lib/result.js";

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

    if (!result.ok) {
      return context.json({ error: result.error }, { status: 500 });
    }

    return context.json({ data: result.value });
  });
  router.post("/", async (context) => {
    const json = await readJsonObject(context);

    if (!json.ok) {
      return context.json({ error: json.error }, { status: 400 });
    }

    const input = toCreateSourceEndpointInput(json.value);
    const result = await createSource(input);

    if (!result.ok) {
      return context.json(
        { error: result.error },
        { status: createSourceErrorStatus(result.error.code) },
      );
    }

    return context.json({ data: result.value }, { status: 201 });
  });
  router.post("/inspect", async (context) => {
    const json = await readJsonObject(context);

    if (!json.ok) {
      return context.json({ error: json.error }, { status: 400 });
    }

    const input = toInspectSourceEndpointInput(json.value);
    const result = await inspectSource(input);

    if (!result.ok) {
      return context.json(
        { error: result.error },
        {
          status:
            result.error.code === "source_inspect_fetch_failed" ? 502 : 422,
        },
      );
    }

    return context.json({ data: result.value });
  });
  router.post("/:sourceId/observe", async (context) => {
    const result = await enqueueObserveSource(
      requireRouteParam(context.req.param("sourceId"), "sourceId"),
    );

    if (!result.ok) {
      return context.json(
        { error: result.error },
        { status: result.error.code === "observe_enqueue_failed" ? 500 : 404 },
      );
    }

    return context.json({ data: result.value }, { status: 202 });
  });
  router.patch("/:sourceId/collector-settings", async (context) => {
    const json = await readJsonObject(context);

    if (!json.ok) {
      return context.json({ error: json.error }, { status: 400 });
    }

    const input = toPatchSourceCollectorSettingsEndpointInput(json.value);

    if (!input.ok) {
      return context.json({ error: input.error }, { status: 422 });
    }

    const result = await patchSourceCollectorSettings(
      requireRouteParam(context.req.param("sourceId"), "sourceId"),
      input.value,
    );

    if (!result.ok) {
      return context.json(
        { error: result.error },
        { status: patchSourceCollectorSettingsErrorStatus(result.error.code) },
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

async function readJsonObject(
  context: Context,
): Promise<
  Result<Record<string, unknown>, { code: "invalid_json"; message: string }>
> {
  const json: unknown = await context.req.json().catch(() => null);

  if (json === null || typeof json !== "object") {
    return err({
      code: "invalid_json",
      message: "Request body must be a JSON object.",
    });
  }

  return ok(json as Record<string, unknown>);
}

function toCreateSourceEndpointInput(
  value: Record<string, unknown>,
): CreateSourceEndpointInput {
  return {
    description: toOptionalString(value.description),
    sourceSlug: toOptionalString(value.sourceSlug),
    title: toOptionalString(value.title),
    url: toOptionalString(value.url),
  };
}

function toInspectSourceEndpointInput(
  value: Record<string, unknown>,
): InspectSourceEndpointInput {
  return {
    url: toOptionalString(value.url),
  };
}

function toPatchSourceCollectorSettingsEndpointInput(
  value: Record<string, unknown>,
): Result<
  PatchSourceCollectorSettingsEndpointInput,
  { code: "invalid_collector_settings"; message: string }
> {
  if (
    typeof value.enabled !== "boolean" ||
    !isPositiveInteger(value.intervalMinutes) ||
    !isPositiveInteger(value.baseVersion)
  ) {
    return err({
      code: "invalid_collector_settings",
      message:
        "Collector settings require boolean enabled and positive intervalMinutes and baseVersion.",
    });
  }

  return ok({
    baseVersion: value.baseVersion,
    enabled: value.enabled,
    intervalMinutes: value.intervalMinutes,
  });
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function createSourceErrorStatus(
  code:
    | "duplicate_source"
    | "source_create_failed"
    | "source_url_required"
    | "source_url_invalid",
): 409 | 500 | 422 {
  if (code === "duplicate_source") {
    return 409;
  }

  if (code === "source_create_failed") {
    return 500;
  }

  return 422;
}

function patchSourceCollectorSettingsErrorStatus(
  code:
    | "collector_settings_conflict"
    | "collector_settings_update_failed"
    | "source_not_found",
): 409 | 500 | 404 {
  if (code === "collector_settings_conflict") {
    return 409;
  }

  if (code === "collector_settings_update_failed") {
    return 500;
  }

  return 404;
}
