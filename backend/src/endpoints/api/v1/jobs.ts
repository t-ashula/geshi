import type { AppDependencies } from "../../../deps.js";
import type { JsonEndpointResult } from "../../types.js";

export function createGetJobEndpoint(dependencies: AppDependencies) {
  return async (jobId: string): Promise<JsonEndpointResult> => {
    const result = await dependencies.jobService.findJobById(jobId);

    if (!result.ok) {
      return {
        body: {
          error: {
            code: result.error.code,
            message: result.error.message,
          },
        },
        status: 404,
      };
    }

    return {
      body: {
        data: result.value,
      },
      status: 200,
    };
  };
}
