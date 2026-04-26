import type { Hono } from "hono";

import { DuplicateSourceUrlHashError } from "../../../db/source-repository.js";
import type { SourceService } from "../../../service/source-service.js";
import { InvalidSourceUrlError } from "../../../service/source-service.js";

type App = Hono;

export function registerSourceRoutes(
  app: App,
  sourceService: SourceService,
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
      const createdSource = await sourceService.createSource({
        description: toOptionalString(body.description),
        title: toOptionalString(body.title),
        url: toOptionalString(body.url) ?? "",
      });

      return context.json(
        {
          data: createdSource,
        },
        201,
      );
    } catch (error) {
      if (error instanceof InvalidSourceUrlError) {
        return context.json(
          {
            error: {
              code: error.code,
              message: error.message,
            },
          },
          422,
        );
      }

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
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
