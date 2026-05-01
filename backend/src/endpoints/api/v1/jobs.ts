import type { JobListItem } from "../../../db/job-repository.js";
import type { AppDependencies } from "../../../deps.js";
import type { Result } from "../../../lib/result.js";
import type { FindJobByIdError } from "../../../service/job-service.js";

export function createGetJobEndpoint(dependencies: AppDependencies) {
  return async (
    jobId: string,
  ): Promise<Result<JobListItem, FindJobByIdError>> =>
    dependencies.jobService.findJobById(jobId);
}
