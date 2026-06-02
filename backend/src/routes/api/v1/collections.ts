import type { Context } from "hono";
import { Hono } from "hono";

import type { AppDependencies } from "../../../deps.js";
import type {
  CreateSourceCollectionEndpointInput,
  UpdateSourceCollectionEndpointInput,
} from "../../../endpoints/api/v1/sources.js";
import {
  createCreateSourceCollectionEndpoint,
  createListSourceCollectionsEndpoint,
  createUpdateSourceCollectionEndpoint,
} from "../../../endpoints/api/v1/sources.js";
import type { Result } from "../../../lib/result.js";
import { err, ok } from "../../../lib/result.js";

export function createCollectionRoutes(dependencies: AppDependencies): Hono {
  const router = new Hono();
  const listSourceCollections =
    createListSourceCollectionsEndpoint(dependencies);
  const createSourceCollection =
    createCreateSourceCollectionEndpoint(dependencies);
  const updateSourceCollection =
    createUpdateSourceCollectionEndpoint(dependencies);

  router.get("/", async (context) => {
    const result = await listSourceCollections();

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

    const input = toCreateSourceCollectionEndpointInput(json.value);

    if (!input.ok) {
      return context.json({ error: input.error }, { status: 422 });
    }

    const result = await createSourceCollection(input.value);

    if (!result.ok) {
      return context.json({ error: result.error }, { status: 500 });
    }

    return context.json({ data: result.value }, { status: 201 });
  });

  router.patch("/:collectionId", async (context) => {
    const json = await readJsonObject(context);

    if (!json.ok) {
      return context.json({ error: json.error }, { status: 400 });
    }

    const input = toUpdateSourceCollectionEndpointInput(json.value);

    if (!input.ok) {
      return context.json({ error: input.error }, { status: 422 });
    }

    const result = await updateSourceCollection(
      requireRouteParam(context.req.param("collectionId"), "collectionId"),
      input.value,
    );

    if (!result.ok) {
      return context.json(
        { error: result.error },
        {
          status: result.error.code === "collection_not_found" ? 404 : 500,
        },
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
  let json: unknown;

  try {
    json = await context.req.json();
  } catch {
    return err({
      code: "invalid_json",
      message: "Request body must be a JSON object.",
    });
  }

  if (json === null || typeof json !== "object") {
    return err({
      code: "invalid_json",
      message: "Request body must be a JSON object.",
    });
  }

  return ok(json as Record<string, unknown>);
}

function toCreateSourceCollectionEndpointInput(
  value: Record<string, unknown>,
): Result<
  CreateSourceCollectionEndpointInput,
  { code: "invalid_source_collection"; message: string }
> {
  if (
    typeof value.title !== "string" ||
    value.title.trim() === "" ||
    !isNullablePositiveIntegerOrZero(value.position)
  ) {
    return err({
      code: "invalid_source_collection",
      message:
        "Source collection requires non-empty title and non-negative position.",
    });
  }

  return ok({
    parentCollectionId: toOptionalString(value.parentCollectionId) ?? null,
    position: value.position,
    title: value.title.trim(),
  });
}

function toUpdateSourceCollectionEndpointInput(
  value: Record<string, unknown>,
): Result<
  UpdateSourceCollectionEndpointInput,
  { code: "invalid_source_collection_update"; message: string }
> {
  if (
    typeof value.title !== "string" ||
    value.title.trim() === "" ||
    !isNullablePositiveIntegerOrZero(value.position)
  ) {
    return err({
      code: "invalid_source_collection_update",
      message:
        "Source collection update requires non-empty title and non-negative position.",
    });
  }

  return ok({
    parentCollectionId: toOptionalString(value.parentCollectionId) ?? null,
    position: value.position,
    title: value.title.trim(),
  });
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isNullablePositiveIntegerOrZero(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}
