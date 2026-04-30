import { v7 as uuidv7 } from "uuid";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppSettingRepository } from "../../src/db/app-setting-repository.js";
import { JobRepository } from "../../src/db/job-repository.js";
import { SourceRepository } from "../../src/db/source-repository.js";
import type { JobPayload } from "../../src/job-queue/types.js";
import {
  OBSERVE_SOURCE_JOB_NAME,
  PERIODIC_CRAWL_JOB_NAME,
} from "../../src/job-queue/types.js";
import { err } from "../../src/lib/result.js";
import { createNoopLogger } from "../../src/logger/index.js";
import { AppSettingService } from "../../src/service/app-setting-service.js";
import { JobService } from "../../src/service/job-service.js";
import { SourceService } from "../../src/service/source-service.js";
import { handlePeriodicCrawlJob } from "../../src/workers/periodic-crawl/handle.js";
import {
  createTestDatabase,
  destroyTestDatabase,
} from "../db/test-database.js";

describe("handlePeriodicCrawlJob", () => {
  let testDatabase: Awaited<ReturnType<typeof createTestDatabase>>;

  beforeEach(async () => {
    testDatabase = await createTestDatabase();
  });

  it("enqueues observe jobs for due sources and schedules itself again", async () => {
    const sourceRepository = new SourceRepository(testDatabase.database);
    const sourceService = new SourceService(sourceRepository);
    const jobRepository = new JobRepository(testDatabase.database);
    const appSettingRepository = new AppSettingRepository(
      testDatabase.database,
    );
    const appSettingService = new AppSettingService(appSettingRepository);
    const enqueuedJobs: Array<{
      name: string;
      payload: JobPayload;
      startAfter: Date | null;
    }> = [];
    const source = await sourceRepository.createSource({
      collectorSettingId: uuidv7(),
      collectorSettingSnapshotId: uuidv7(),
      id: uuidv7(),
      kind: "podcast",
      pluginSlug: "podcast-rss",
      slug: "source-one",
      snapshotId: uuidv7(),
      url: "https://example.com/feed.xml",
      urlHash: "hash-1",
    });
    if (!source.ok) {
      throw source.error;
    }

    const updatedSource = await sourceRepository.updateSourceCollectorSettings(
      source.value.id,
      {
        enabled: true,
        intervalMinutes: 30,
      },
      source.value.collectorSettingsVersion ?? 1,
    );
    if (!updatedSource.ok) {
      throw updatedSource.error;
    }

    const updatedSettings = await appSettingService.updatePeriodicCrawlSettings(
      {
        enabled: true,
        intervalMinutes: 5,
      },
    );
    if (!updatedSettings.ok) {
      throw updatedSettings.error;
    }

    const periodicJob = await jobRepository.createJob({
      id: uuidv7(),
      kind: PERIODIC_CRAWL_JOB_NAME,
      retryable: true,
      sourceId: null,
    });
    if (!periodicJob.ok) {
      throw periodicJob.error;
    }
    const jobQueue = {
      enqueue: (name: string, payload: JobPayload) => {
        enqueuedJobs.push({
          name,
          payload,
          startAfter: null,
        });

        return Promise.resolve(`queue-${enqueuedJobs.length}`);
      },
      enqueueAfter: (name: string, payload: JobPayload, startAfter: Date) => {
        enqueuedJobs.push({
          name,
          payload,
          startAfter,
        });

        return Promise.resolve(`queue-${enqueuedJobs.length}`);
      },
    };
    const jobService = new JobService(sourceService, jobRepository, jobQueue);
    const dateNowSpy = vi
      .spyOn(Date, "now")
      .mockReturnValue(new Date("2026-04-30T00:00:00Z").getTime());

    try {
      const result = await handlePeriodicCrawlJob(
        {
          jobId: periodicJob.value.id,
        },
        {
          appSettingService,
          jobQueue,
          jobRepository,
          jobService,
          logger: createNoopLogger(),
          sourceService,
        },
      );

      expect(result.ok).toBe(true);
    } finally {
      dateNowSpy.mockRestore();
    }

    expect(
      enqueuedJobs.filter((job) => job.name === OBSERVE_SOURCE_JOB_NAME),
    ).toHaveLength(1);
    expect(
      enqueuedJobs.filter((job) => job.name === PERIODIC_CRAWL_JOB_NAME),
    ).toHaveLength(1);
    expect(
      enqueuedJobs.find((job) => job.name === PERIODIC_CRAWL_JOB_NAME)
        ?.startAfter,
    ).toEqual(new Date("2026-04-30T00:05:00Z"));
    expect(
      (await jobRepository.findJobById(periodicJob.value.id))?.status,
    ).toBe("succeeded");

    await destroyTestDatabase(testDatabase);
  });

  it("returns an error result and marks the job as failed when settings load fails", async () => {
    const jobRepository = new JobRepository(testDatabase.database);
    const periodicJob = await jobRepository.createJob({
      id: uuidv7(),
      kind: PERIODIC_CRAWL_JOB_NAME,
      retryable: true,
      sourceId: null,
    });

    if (!periodicJob.ok) {
      throw periodicJob.error;
    }

    const result = await handlePeriodicCrawlJob(
      {
        jobId: periodicJob.value.id,
      },
      {
        appSettingService: {
          getPeriodicCrawlSettings: () =>
            Promise.resolve(
              err(new Error("Periodic crawl settings load failed.")),
            ),
        } as AppSettingService,
        jobQueue: {
          enqueue: () => Promise.resolve("queue-job"),
          enqueueAfter: () => Promise.resolve("queue-job-after"),
        },
        jobRepository,
        jobService: {} as JobService,
        logger: createNoopLogger(),
        sourceService: {} as SourceService,
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected periodic crawl to fail.");
    }

    expect(result.error.message).toContain(
      "Periodic crawl settings load failed.",
    );
    expect(
      (await jobRepository.findJobById(periodicJob.value.id))?.status,
    ).toBe("failed");

    await destroyTestDatabase(testDatabase);
  });
});
