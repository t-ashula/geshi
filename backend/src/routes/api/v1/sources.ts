import type { Hono } from "hono";

import {
  CollectorSettingsVersionConflictError,
  DuplicateSourceUrlHashError,
} from "../../../db/source-repository.js";
import type { JobService } from "../../../service/job-service.js";
import type {
  InspectSourceError,
  SourceInspectService,
} from "../../../service/source-inspect-service.js";
import type { SourceService } from "../../../service/source-service.js";

type App = Hono;

export function registerSourceRoutes(
  app: App,
  sourceService: SourceService,
  sourceInspectService: SourceInspectService,
  jobService: JobService,
): void {
  app.get("/api/v1/sources", async (context) => {
    const sources = await sourceService.listSources();

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
  });

  app.post("/api/v1/sources", async (context) => {
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

    const result = await sourceService.createSource({
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
  });

  app.post("/api/v1/sources/inspect", async (context) => {
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
    const result = await sourceInspectService.inspectSource({
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
  });

  app.post("/api/v1/sources/:sourceId/observe", async (context) => {
    const result = await jobService.enqueueObserveSourceJob(
      context.req.param("sourceId"),
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
  });

  app.patch("/api/v1/sources/:sourceId/collector-settings", async (context) => {
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

    const result = await sourceService.updateSourceCollectorSettings(
      context.req.param("sourceId"),
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
  });
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function inspectSourceStatus(_error: InspectSourceError): 422 {
  return 422;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}
