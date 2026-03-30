import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Job, JobEvent } from "../src/job/index.js";
import {
  JobApi,
  JobApiValidationError,
  JobNotFoundError,
} from "../src/job/index.js";

const { createUuidV7Mock } = vi.hoisted(() => {
  return {
    createUuidV7Mock: vi.fn(),
  };
});

vi.mock("../src/job/id.js", () => {
  return {
    createUuidV7: createUuidV7Mock,
  };
});

describe("JobApi", () => {
  const store = {
    appendJobEvent: vi.fn(),
    createJob: vi.fn(),
    getJob: vi.fn(),
    listJobs: vi.fn(),
  };

  beforeEach(() => {
    createUuidV7Mock.mockReset();
    store.appendJobEvent.mockReset();
    store.createJob.mockReset();
    store.getJob.mockReset();
    store.listJobs.mockReset();
  });

  it("creates a job with generated uuid v7", async () => {
    createUuidV7Mock.mockReturnValue("018f0f2e-18ef-7000-8000-000000000001");
    store.createJob.mockResolvedValue({
      createdAt: "2026-03-30T00:00:00.000Z",
      failureStage: null,
      id: "018f0f2e-18ef-7000-8000-000000000001",
      kind: "observeChannel",
      note: null,
      occurredAt: "2026-03-30T00:00:00.000Z",
      payload: { channelId: "channel-1", force: false },
      runAfter: null,
      status: "registered",
    } satisfies Job);

    const api = new JobApi(store);
    const job = await api.createJob({
      kind: "observeChannel",
      payload: { channelId: "channel-1", force: false },
    });

    expect(job.id).toBe("018f0f2e-18ef-7000-8000-000000000001");
    expect(store.createJob).toHaveBeenCalledWith({
      createdAt: expect.any(String),
      id: "018f0f2e-18ef-7000-8000-000000000001",
      kind: "observeChannel",
      payload: { channelId: "channel-1", force: false },
      runAfter: null,
    });
  });

  it("rejects invalid create payload", async () => {
    const api = new JobApi(store);

    await expect(api.createJob({ payload: {} })).rejects.toThrow(
      JobApiValidationError,
    );
  });

  it("returns a job on getJob", async () => {
    store.getJob.mockResolvedValue({
      createdAt: "2026-03-30T00:00:00.000Z",
      failureStage: null,
      id: "job-1",
      kind: "scheduleObserve",
      note: null,
      occurredAt: "2026-03-30T00:00:00.000Z",
      payload: { channelIds: ["channel-1"] },
      runAfter: null,
      status: "registered",
    } satisfies Job);

    const api = new JobApi(store);
    const job = await api.getJob("job-1");

    expect(job.id).toBe("job-1");
  });

  it("raises not found on missing job", async () => {
    store.getJob.mockResolvedValue(null);

    const api = new JobApi(store);

    await expect(api.getJob("missing")).rejects.toThrow(JobNotFoundError);
  });

  it("lists jobs", async () => {
    store.listJobs.mockResolvedValue([
      {
        createdAt: "2026-03-30T00:00:00.000Z",
        failureStage: null,
        id: "job-1",
        kind: "scheduleObserve",
        note: null,
        occurredAt: "2026-03-30T00:00:00.000Z",
        payload: { channelIds: ["channel-1"] },
        runAfter: null,
        status: "registered",
      } satisfies Job,
    ]);

    const api = new JobApi(store);
    const jobs = await api.listJobs();

    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.id).toBe("job-1");
  });

  it("appends an event", async () => {
    store.appendJobEvent.mockResolvedValue({
      failureStage: null,
      id: "0195e3e0-0000-7000-8000-000000000101",
      jobId: "job-1",
      note: null,
      occurredAt: "2026-03-30T00:00:01.000Z",
      runtimeJobId: "runtime-1",
      status: "running",
    } satisfies JobEvent);

    const api = new JobApi(store);
    const event = await api.appendJobEvent("job-1", {
      runtimeJobId: "runtime-1",
      status: "running",
    });

    expect(event.status).toBe("running");
    expect(store.appendJobEvent).toHaveBeenCalledWith({
      failureStage: null,
      jobId: "job-1",
      note: null,
      occurredAt: expect.any(String),
      runtimeJobId: "runtime-1",
      status: "running",
    });
  });

  it("maps foreign key failure to not found", async () => {
    store.appendJobEvent.mockRejectedValue({ code: "23503" });

    const api = new JobApi(store);

    await expect(
      api.appendJobEvent("missing", { status: "failed" }),
    ).rejects.toThrow(JobNotFoundError);
  });
});
