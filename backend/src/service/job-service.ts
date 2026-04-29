import { v7 as uuidv7 } from "uuid";

import type { JobListItem, JobRepository } from "../db/job-repository.js";
import type { JobQueue } from "../job-queue/types.js";
import { OBSERVE_SOURCE_JOB_NAME } from "../job-queue/types.js";
import type { SourceService } from "./source-service.js";

export class SourceNotFoundError extends Error {
  public constructor(sourceId: string) {
    super(`Source not found: ${sourceId}`);
    this.name = "SourceNotFoundError";
  }
}

export class JobService {
  public constructor(
    private readonly sourceService: SourceService,
    private readonly jobRepository: JobRepository,
    private readonly jobQueue: JobQueue,
  ) {}

  public async enqueueObserveSourceJob(sourceId: string): Promise<JobListItem> {
    const observeSourceTarget =
      await this.sourceService.findObserveSourceTarget(sourceId);

    if (observeSourceTarget === null) {
      throw new SourceNotFoundError(sourceId);
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

    return persistedJob;
  }

  public async findJobById(id: string): Promise<JobListItem | null> {
    return this.jobRepository.findJobById(id);
  }
}
