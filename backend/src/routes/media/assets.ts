import { Hono } from "hono";

import type { AppDependencies } from "../../deps.js";
import { createGetMediaAssetEndpoint } from "../../endpoints/media/assets.js";

export function createMediaAssetRoutes(dependencies: AppDependencies): Hono {
  const router = new Hono();
  const getMediaAsset = createGetMediaAssetEndpoint(dependencies);

  router.get("/:assetIdWithExtension", async (context) => {
    const result = await getMediaAsset(
      requireRouteParam(
        context.req.param("assetIdWithExtension"),
        "assetIdWithExtension",
      ),
    );

    if (result.body === null) {
      return context.notFound();
    }

    return new Response(Uint8Array.from(result.body).buffer, {
      headers: result.headers,
      status: result.status,
    });
  });

  return router;
}

function requireRouteParam(value: string | undefined, name: string): string {
  if (value === undefined) {
    throw new Error(`Missing route param: ${name}`);
  }

  return value;
}
