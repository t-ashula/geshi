import type { Context } from "hono";

import {
  CollectorSettingsVersionConflictError,
  DuplicateSourceUrlHashError,
} from "../../../db/source-repository.js";
import type { AppDependencies } from "../../../deps.js";
import type { InspectSourceError } from "../../../service/source-inspect-service.js";

export function createListSourcesHandler(dependencies: AppDependencies) {
  return async (context: Context) => {
    const sources = await dependencies.sourceService.listSources();

    if (!sources.ok) {
      return context.json(
        {
          error: {
            code: "source_list_failed",
            message: sources.error.message,
          },
        },
        500,
      );
    }

    return context.json({
      data: sources.value,
    });
  };
}

export function createCreateSourceHandler(dependencies: AppDependencies) {
  return async (context: Context) => {
    const json: unknown = await context.req.json().catch(() => null);

    if (json === null || typeof json !== "object") {
      return context.json(
        {
          error: {
            code: "invalid_json",
            message: "Request body must be a JSON object.",
          },
        },
        400,
      );
    }

    const body = json as Record<string, unknown>;

    const result = await dependencies.sourceService.createSource({
      description: toOptionalString(body.description),
      sourceSlug: toOptionalString(body.sourceSlug),
      title: toOptionalString(body.title),
      url: toOptionalString(body.url) ?? "",
    });

    if (!result.ok) {
      if (result.error instanceof DuplicateSourceUrlHashError) {
        return context.json(
          {
            error: {
              code: "duplicate_source",
              message: "A source for this RSS URL already exists.",
            },
          },
          409,
        );
      }

      if (result.error instanceof Error) {
        return context.json(
          {
            error: {
              code: "source_create_failed",
              message: result.error.message,
            },
          },
          500,
        );
      }

      return context.json(
        {
          error: {
            code: result.error.code,
            message: result.error.message,
          },
        },
        422,
      );
    }

    return context.json(
      {
        data: result.value,
      },
      201,
    );
  };
}

export function createInspectSourceHandler(dependencies: AppDependencies) {
  return async (context: Context) => {
    const json: unknown = await context.req.json().catch(() => null);

    if (json === null || typeof json !== "object") {
      return context.json(
        {
          error: {
            code: "invalid_json",
            message: "Request body must be a JSON object.",
          },
        },
        400,
      );
    }

    const body = json as Record<string, unknown>;
    const result = await dependencies.sourceInspectService.inspectSource({
      url: toOptionalString(body.url) ?? "",
    });

    if (!result.ok) {
      return context.json(
        {
          error: {
            code: result.error.code,
            message: result.error.message,
          },
        },
        inspectSourceStatus(result.error),
      );
    }

    return context.json({
      data: result.value,
    });
  };
}

export function createEnqueueObserveSourceHandler(
  dependencies: AppDependencies,
) {
  return async (context: Context) => {
    const result = await dependencies.jobService.enqueueObserveSourceJob(
      requireRouteParam(context, "sourceId"),
    );

    if (!result.ok) {
      if (result.error instanceof Error) {
        return context.json(
          {
            error: {
              code: "observe_enqueue_failed",
              message: result.error.message,
            },
          },
          500,
        );
      }

      return context.json(
        {
          error: {
            code: result.error.code,
            message: result.error.message,
          },
        },
        404,
      );
    }

    return context.json({ data: result.value }, 202);
  };
}

export function createPatchSourceCollectorSettingsHandler(
  dependencies: AppDependencies,
) {
  return async (context: Context) => {
    const json: unknown = await context.req.json().catch(() => null);

    if (json === null || typeof json !== "object") {
      return context.json(
        {
          error: {
            code: "invalid_json",
            message: "Request body must be a JSON object.",
          },
        },
        400,
      );
    }

    const body = json as Record<string, unknown>;

    if (
      typeof body.enabled !== "boolean" ||
      !isPositiveInteger(body.intervalMinutes) ||
      !isPositiveInteger(body.baseVersion)
    ) {
      return context.json(
        {
          error: {
            code: "invalid_collector_settings",
            message:
              "Collector settings require boolean enabled and positive intervalMinutes and baseVersion.",
          },
        },
        422,
      );
    }

    const result =
      await dependencies.sourceService.updateSourceCollectorSettings(
        requireRouteParam(context, "sourceId"),
        {
          enabled: body.enabled,
          intervalMinutes: body.intervalMinutes,
        },
        body.baseVersion,
      );

    if (!result.ok) {
      if (result.error instanceof CollectorSettingsVersionConflictError) {
        return context.json(
          {
            error: {
              code: "collector_settings_conflict",
              message: "Collector settings were updated by another request.",
            },
          },
          409,
        );
      }

      if (result.error instanceof Error) {
        return context.json(
          {
            error: {
              code: "collector_settings_update_failed",
              message: result.error.message,
            },
          },
          500,
        );
      }

      return context.json(
        {
          error: {
            code: result.error.code,
            message: result.error.message,
          },
        },
        404,
      );
    }

    return context.json({
      data: result.value,
    });
  };
}

function inspectSourceStatus(error: InspectSourceError): 422 | 502 {
  return error.code === "source_inspect_fetch_failed" ? 502 : 422;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function requireRouteParam(context: Context, name: string): string {
  const value = context.req.param(name);

  if (value === undefined) {
    throw new Error(`Missing route param: ${name}`);
  }

  return value;
}
