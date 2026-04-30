import { v7 as uuidv7 } from "uuid";

import type { JobListItem, JobRepository } from "../db/job-repository.js";
import type { JobQueue } from "../job-queue/types.js";
import { OBSERVE_SOURCE_JOB_NAME } from "../job-queue/types.js";
import type { Result } from "../lib/result.js";
import { err, ok } from "../lib/result.js";
import type { SourceService } from "./source-service.js";

export type EnqueueObserveSourceJobError = {
  code: "source_not_found";
  message: string;
};

export class JobService {
  public constructor(
    private readonly sourceService: SourceService,
    private readonly jobRepository: JobRepository,
    private readonly jobQueue: JobQueue,
  ) {}

  public async enqueueObserveSourceJob(
    sourceId: string,
  ): Promise<Result<JobListItem, EnqueueObserveSourceJobError>> {
    const observeSourceTarget =
      await this.sourceService.findObserveSourceTarget(sourceId);

    if (observeSourceTarget === null) {
      return err({
        code: "source_not_found",
        message: "Source not found.",
      });
    }

    const job = await this.jobRepository.createJob({
      id: uuidv7(),
      kind: "observe-source",
      retryable: true,
      sourceId,
    });
    const queueJobId = await this.jobQueue.enqueue(OBSERVE_SOURCE_JOB_NAME, {
      collector: {
        config: observeSourceTarget.config,
        pluginSlug: observeSourceTarget.pluginSlug,
        settingId: observeSourceTarget.collectorSettingId,
        settingSnapshotId: observeSourceTarget.collectorSettingSnapshotId,
      },
      jobId: job.id,
      source: {
        id: observeSourceTarget.sourceId,
        kind: observeSourceTarget.sourceKind,
        slug: observeSourceTarget.slug,
        url: observeSourceTarget.url,
      },
    });

    await this.jobRepository.attachQueueJobId(job.id, queueJobId);

    const persistedJob = await this.jobRepository.findJobById(job.id);

    if (persistedJob === null) {
      throw new Error(`Job disappeared after enqueue: ${job.id}`);
    }

    return ok(persistedJob);
  }

  public async findJobById(id: string): Promise<JobListItem | null> {
    return this.jobRepository.findJobById(id);
  }
}
