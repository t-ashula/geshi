import { Hono } from "hono";

import type { AppDependencies } from "../../../deps.js";
import { createUnsubscribeEndpoint } from "../../../endpoints/api/v1/sources.js";

export function createSubscriptionRoutes(dependencies: AppDependencies): Hono {
  const router = new Hono();
  const unsubscribe = createUnsubscribeEndpoint(dependencies);

  router.delete("/:subscriptionId", async (context) => {
    const subscriptionId = context.req.param("subscriptionId");

    if (subscriptionId === undefined) {
      return context.json(
        {
          error: {
            code: "invalid_subscription",
            message: "Subscription id is required.",
          },
        },
        { status: 400 },
      );
    }

    const result = await unsubscribe(subscriptionId);

    if (!result.ok) {
      return context.json(
        { error: result.error },
        {
          status: result.error.code === "subscription_not_found" ? 404 : 500,
        },
      );
    }

    return context.body(null, 204);
  });

  return router;
}
