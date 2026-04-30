import { describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import { AppSettingRepository } from "../../src/db/app-setting-repository.js";
import { AssetRepository } from "../../src/db/asset-repository.js";
import { ContentRepository } from "../../src/db/content-repository.js";
import { JobRepository } from "../../src/db/job-repository.js";
import { SourceRepository } from "../../src/db/source-repository.js";
import type { JobPayload, JobQueue } from "../../src/job-queue/types.js";
import { AppSettingService } from "../../src/service/app-setting-service.js";
import { AssetService } from "../../src/service/asset-service.js";
import { ContentService } from "../../src/service/content-service.js";
import { JobService } from "../../src/service/job-service.js";
import { SourceInspectService } from "../../src/service/source-inspect-service.js";
import { SourceService } from "../../src/service/source-service.js";
import { FilesystemStorage } from "../../src/storage/filesystem-storage.js";
import {
  createTestDatabase,
  destroyTestDatabase,
} from "../db/test-database.js";

describe("/api/v1/settings/periodic-crawl", () => {
  it("returns default settings", async () => {
    const testDatabase = await createTestDatabase();

    try {
      const app = createTestApp(testDatabase);
      const response = await app.request("/api/v1/settings/periodic-crawl");

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        data: {
          enabled: false,
          intervalMinutes: 15,
        },
      });
    } finally {
      await destroyTestDatabase(testDatabase);
    }
  });

  it("updates settings", async () => {
    const testDatabase = await createTestDatabase();

    try {
      const app = createTestApp(testDatabase);
      const response = await app.request("/api/v1/settings/periodic-crawl", {
        body: JSON.stringify({
          enabled: true,
          intervalMinutes: 5,
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "PATCH",
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        data: {
          enabled: true,
          intervalMinutes: 5,
        },
      });
    } finally {
      await destroyTestDatabase(testDatabase);
    }
  });
});

function createTestApp(
  testDatabase: Awaited<ReturnType<typeof createTestDatabase>>,
  jobQueue: JobQueue = {
    enqueue: (_name: string, _payload: JobPayload) =>
      Promise.resolve("queue-job-test"),
    enqueueAfter: (_name: string, _payload: JobPayload, _startAfter: Date) =>
      Promise.resolve("queue-job-test"),
  },
) {
  const assetRepository = new AssetRepository(testDatabase.database);
  const assetService = new AssetService(assetRepository);
  const contentRepository = new ContentRepository(testDatabase.database);
  const contentService = new ContentService(contentRepository);
  const jobRepository = new JobRepository(testDatabase.database);
  const appSettingRepository = new AppSettingRepository(testDatabase.database);
  const appSettingService = new AppSettingService(appSettingRepository);
  const sourceRepository = new SourceRepository(testDatabase.database);
  const sourceService = new SourceService(sourceRepository);
  const sourceInspectService = new SourceInspectService();
  const jobService = new JobService(sourceService, jobRepository, jobQueue);
  const storage = new FilesystemStorage("/tmp/geshi-test-storage");

  return createApp(
    sourceService,
    sourceInspectService,
    assetService,
    contentService,
    jobService,
    appSettingService,
    storage,
  );
}
