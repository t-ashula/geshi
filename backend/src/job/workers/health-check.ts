import type { Logger } from "../../logger/index.js";
import { createLogger } from "../../logger/index.js";
import type { FunctionalJobContext, FunctionalJobOutput } from "../runtime/type.js";

export type HealthCheckJobPayload = {
  testRunId?: string;
};

type CreateHealthCheckWorkerInput = {
  logger?: Logger;
};

export function createHealthCheckWorker(
  input: CreateHealthCheckWorkerInput = {},
): (
  context: FunctionalJobContext,
  payload: HealthCheckJobPayload,
) => Promise<FunctionalJobOutput> {
  const logger =
    input.logger ?? createLogger({ component: "job-worker-health-check" });

  return async (context, payload) => {
    logger.info("HealthCheck worker reached.", {
      jobId: context.jobId,
      testRunId: payload.testRunId ?? null,
    });
    logger.debug("HealthCheck worker payload.", {
      jobId: context.jobId,
      payload,
    });

    return {
      importInstructions: null,
      note: "HealthCheck completed",
    };
  };
}
