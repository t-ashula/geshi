import { v7 as uuidv7 } from "uuid";

import type { JobListItem, JobRepository } from "../db/job-repository.js";
import type { JobQueue } from "../job-queue/types.js";
import { OBSERVE_SOURCE_JOB_NAME } from "../job-queue/types.js";
import type { Result } from "../lib/result.js";
import { err, ok } from "../lib/result.js";
import type {
  FindObserveSourceTargetError,
  SourceService,
} from "./source-service.js";

export type EnqueueObserveSourceJobError = FindObserveSourceTargetError;
export type EnqueueObserveSourceJobInfrastructureError = Error;

export type FindJobByIdError = {
  code: "job_not_found";
  message: string;
};

export interface JobService {
  enqueueObserveSourceJob(
    sourceId: string,
  ): Promise<
    Result<
      JobListItem,
      EnqueueObserveSourceJobError | EnqueueObserveSourceJobInfrastructureError
    >
  >;
  findJobById(id: string): Promise<Result<JobListItem, FindJobByIdError>>;
}

export function createJobService(
  sourceService: SourceService,
  jobRepository: JobRepository,
  jobQueue: JobQueue,
): JobService {
  return {
    async enqueueObserveSourceJob(
      sourceId: string,
    ): Promise<
      Result<
        JobListItem,
        | EnqueueObserveSourceJobError
        | EnqueueObserveSourceJobInfrastructureError
      >
    > {
      const observeSourceTarget =
        await sourceService.findObserveSourceTarget(sourceId);

      if (!observeSourceTarget.ok) {
        return observeSourceTarget;
      }

      const jobId = uuidv7();
      const queuePayload = {
        collector: {
          config: observeSourceTarget.value.config,
          pluginSlug: observeSourceTarget.value.pluginSlug,
          settingId: observeSourceTarget.value.collectorSettingId,
          settingSnapshotId:
            observeSourceTarget.value.collectorSettingSnapshotId,
        },
        jobId,
        source: {
          id: observeSourceTarget.value.sourceId,
          kind: observeSourceTarget.value.sourceKind,
          slug: observeSourceTarget.value.slug,
          url: observeSourceTarget.value.url,
        },
      };

      const job = await jobRepository.createJob({
        id: jobId,
        kind: "observe-source",
        payload: queuePayload,
        retryable: true,
      });

      if (!job.ok) {
        return job;
      }

      const queueJobId = await jobQueue.enqueue(
        OBSERVE_SOURCE_JOB_NAME,
        queuePayload,
      );

      const attachQueueJobIdResult = await jobRepository.attachQueueJobId(
        job.value.id,
        queueJobId,
      );

      if (!attachQueueJobIdResult.ok) {
        return attachQueueJobIdResult;
      }

      const persistedJob = await jobRepository.findJobById(job.value.id);

      if (persistedJob === null) {
        return err(new Error(`Job disappeared after enqueue: ${job.value.id}`));
      }

      return ok(persistedJob);
    },

    async findJobById(
      id: string,
    ): Promise<Result<JobListItem, FindJobByIdError>> {
      const job = await jobRepository.findJobById(id);

      if (job === null) {
        return err({
          code: "job_not_found",
          message: "Job not found.",
        });
      }

      return ok(job);
    },
  };
}
