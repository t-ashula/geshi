import { Hono } from "hono";

import type { ListContentsInput } from "../../../db/content-repository.js";
import type { AppDependencies } from "../../../deps.js";
import {
  createGetContentDetailEndpoint,
  createListContentsEndpoint,
  createRequestTranscriptsEndpoint,
  createRetryTranscriptEndpoint,
} from "../../../endpoints/api/v1/contents.js";

export function createContentRoutes(dependencies: AppDependencies): Hono {
  const router = new Hono();
  const listContents = createListContentsEndpoint(dependencies);
  const getContentDetail = createGetContentDetailEndpoint(dependencies);
  const requestTranscripts = createRequestTranscriptsEndpoint(dependencies);
  const retryTranscript = createRetryTranscriptEndpoint(dependencies);

  router.get("/", async (context) => {
    const input = toListContentsInput(
      context.req.query("cursor"),
      context.req.query("limit"),
      context.req.query("sourceSlug"),
    );

    if (!input.ok) {
      return context.json({ error: input.error }, { status: 400 });
    }

    const data = await listContents(input.value);

    if (!data.ok) {
      return context.json(
        {
          error: {
            code: data.error.code,
            message: data.error.message,
          },
        },
        { status: data.error.code === "invalid_cursor" ? 400 : 500 },
      );
    }

    return context.json({
      data: data.value.items,
      page: {
        nextCursor: data.value.nextCursor,
      },
    });
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
        { status: result.error.code === "content_not_found" ? 404 : 500 },
      );
    }

    return context.json({ data: result.value });
  });
  router.post("/:contentId/transcripts", async (context) => {
    const result = await requestTranscripts(
      requireRouteParam(context.req.param("contentId"), "contentId"),
    );

    if (!result.ok) {
      return context.json(
        {
          error: {
            code:
              "code" in result.error ? result.error.code : "transcript_failed",
            message: result.error.message,
          },
        },
        {
          status:
            "code" in result.error &&
            result.error.code === "content_has_no_audio_assets"
              ? 409
              : 500,
        },
      );
    }

    return context.json({ data: result.value }, { status: 202 });
  });
  router.post(
    "/:contentId/transcripts/:transcriptId/retry",
    async (context) => {
      const result = await retryTranscript(
        requireRouteParam(context.req.param("contentId"), "contentId"),
        requireRouteParam(context.req.param("transcriptId"), "transcriptId"),
      );

      if (!result.ok) {
        return context.json(
          {
            error: {
              code:
                "code" in result.error
                  ? result.error.code
                  : "transcript_retry_failed",
              message: result.error.message,
            },
          },
          {
            status:
              "code" in result.error &&
              result.error.code === "transcript_not_found"
                ? 404
                : 409,
          },
        );
      }

      return context.json({ data: result.value }, { status: 202 });
    },
  );

  return router;
}

const DEFAULT_CONTENTS_LIMIT = 50;
const MAX_CONTENTS_LIMIT = 100;

function toListContentsInput(
  cursor: string | undefined,
  limit: string | undefined,
  sourceSlug: string | undefined,
):
  | { ok: true; value: ListContentsInput }
  | {
      ok: false;
      error: { code: "invalid_limit"; message: string };
    } {
  if (limit === undefined) {
    return {
      ok: true,
      value: {
        cursor,
        limit: DEFAULT_CONTENTS_LIMIT,
        sourceSlug,
      },
    };
  }

  if (!/^\d+$/u.test(limit)) {
    return {
      ok: false,
      error: {
        code: "invalid_limit",
        message: `Content list limit must be between 1 and ${MAX_CONTENTS_LIMIT}.`,
      },
    };
  }

  const parsedLimit = Number.parseInt(limit, 10);

  if (
    !Number.isSafeInteger(parsedLimit) ||
    parsedLimit < 1 ||
    parsedLimit > MAX_CONTENTS_LIMIT
  ) {
    return {
      ok: false,
      error: {
        code: "invalid_limit",
        message: `Content list limit must be between 1 and ${MAX_CONTENTS_LIMIT}.`,
      },
    };
  }

  return {
    ok: true,
    value: {
      cursor,
      limit: parsedLimit,
      sourceSlug,
    },
  };
}

function requireRouteParam(value: string | undefined, name: string): string {
  if (value === undefined) {
    throw new Error(`Missing route param: ${name}`);
  }

  return value;
}
