import { describe, expect, it, vi } from "vitest";

import type { Job, JobApi } from "../src/job/index.js";
import { registerJob } from "../src/job/index.js";

describe("registerJob", () => {
  it("creates a job and enqueues export", async () => {
    const jobApi: JobApi = {
      appendJobEvent: vi.fn(),
      createJob: vi.fn().mockResolvedValue({
        createdAt: "2026-03-31T00:00:00.000Z",
        failureStage: null,
        id: "job-1",
        kind: "observeChannel",
        note: null,
        occurredAt: "2026-03-31T00:00:00.000Z",
        payload: { channelId: "channel-1" },
        runAfter: null,
        status: "registered",
      } satisfies Job),
      getJob: vi.fn(),
      listJobs: vi.fn(),
    };
    const exportQueue = {
      add: vi.fn().mockResolvedValue(undefined),
    };

    const job = await registerJob(jobApi, exportQueue, {
      kind: "observeChannel",
      payload: { channelId: "channel-1" },
    });

    expect(job.id).toBe("job-1");
    expect(exportQueue.add).toHaveBeenCalledWith("export", {
      jobId: "job-1",
    });
  });
});
