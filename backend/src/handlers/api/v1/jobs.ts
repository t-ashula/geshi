import type { Context } from "hono";

import type { AppDependencies } from "../../../deps.js";

export function createGetJobHandler(dependencies: AppDependencies) {
  return async (context: Context) => {
    const result = await dependencies.jobService.findJobById(
      requireRouteParam(context, "jobId"),
    );

    if (!result.ok) {
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

function requireRouteParam(context: Context, name: string): string {
  const value = context.req.param(name);

  if (value === undefined) {
    throw new Error(`Missing route param: ${name}`);
  }

  return value;
}
