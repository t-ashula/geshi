import type { Hono } from "hono";

import { DuplicateSourceUrlHashError } from "../../../db/source-repository.js";
import type { JobService } from "../../../service/job-service.js";
import { SourceNotFoundError } from "../../../service/job-service.js";
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

    return context.json({
      data: sources,
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

    try {
      const result = await sourceService.createSource({
        description: toOptionalString(body.description),
        sourceSlug: toOptionalString(body.sourceSlug),
        title: toOptionalString(body.title),
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
          422,
        );
      }

      return context.json(
        {
          data: result.value,
        },
        201,
      );
    } catch (error) {
      if (error instanceof DuplicateSourceUrlHashError) {
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

      throw error;
    }
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
    try {
      const job = await jobService.enqueueObserveSourceJob(
        context.req.param("sourceId"),
      );

      return context.json({ data: job }, 202);
    } catch (error) {
      if (error instanceof SourceNotFoundError) {
        return context.json(
          {
            error: {
              code: "source_not_found",
              message: "Source not found.",
            },
          },
          404,
        );
      }

      throw error;
    }
  });
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function inspectSourceStatus(_error: InspectSourceError): 422 {
  return 422;
}
