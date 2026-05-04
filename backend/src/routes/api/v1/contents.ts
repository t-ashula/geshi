import { Hono } from "hono";

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

function requireRouteParam(value: string | undefined, name: string): string {
  if (value === undefined) {
    throw new Error(`Missing route param: ${name}`);
  }

  return value;
}
