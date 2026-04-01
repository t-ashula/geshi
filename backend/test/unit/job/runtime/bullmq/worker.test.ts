import { describe, expect, it, vi } from "vitest";

import type {
  FunctionalJobOutput,
  Job,
  JobApi,
  JobRuntime,
} from "../../../../../src/job/index.js";
import {
  runExportJob,
  runImportJob,
  runUpdateJob,
  wrapFunctionalJobWorker,
} from "../../../../../src/job/index.js";

function createApiStub(overrides: Partial<JobApi> = {}): JobApi {
  return {
    appendJobEvent: vi.fn(),
    createJob: vi.fn(),
    getJob: vi.fn(),
    listJobs: vi.fn(),
    ...overrides,
  } as JobApi;
}

describe("job runtime bullmq", () => {
  it("records scheduled when export job is not runnable yet", async () => {
    const api = createApiStub({
      getJob: vi.fn().mockResolvedValue({
        createdAt: "2026-03-31T00:00:00.000Z",
        failureStage: null,
        id: "job-1",
        kind: "observeChannel",
        note: null,
        occurredAt: "2026-03-31T00:00:00.000Z",
        payload: { channelId: "channel-1" },
        runAfter: "2026-03-31T02:00:00.000Z",
        status: "registered",
      } satisfies Job),
    });
    const runtimeQueue = {
      add: vi.fn(),
    };

    await runExportJob(
      api,
      runtimeQueue,
      { jobId: "job-1" },
      new Date("2026-03-31T01:00:00.000Z"),
    );

    expect(runtimeQueue.add).not.toHaveBeenCalled();
    expect(api.appendJobEvent).toHaveBeenCalledWith("job-1", {
      occurredAt: "2026-03-31T01:00:00.000Z",
      status: "scheduled",
    });
  });

  it("enqueues functional job and records queued", async () => {
    const api = createApiStub({
      getJob: vi.fn().mockResolvedValue({
        createdAt: "2026-03-31T00:00:00.000Z",
        failureStage: null,
        id: "job-1",
        kind: "healthCheck",
        note: null,
        occurredAt: "2026-03-31T00:00:00.000Z",
        payload: {},
        runAfter: null,
        status: "registered",
      } satisfies Job),
    });
    const runtimeQueue = {
      add: vi.fn().mockResolvedValue({ id: "runtime-1" }),
    };

    await runExportJob(
      api,
      runtimeQueue,
      { jobId: "job-1" },
      new Date("2026-03-31T01:00:00.000Z"),
    );

    expect(runtimeQueue.add).toHaveBeenCalledWith("healthCheck", {
      context: {
        jobId: "job-1",
      },
      payload: {},
    });
    expect(api.appendJobEvent).toHaveBeenCalledWith("job-1", {
      occurredAt: "2026-03-31T01:00:00.000Z",
      runtimeJobId: "runtime-1",
      status: "queued",
    });
  });

  it("ignores non-registered jobs in export", async () => {
    const api = createApiStub({
      getJob: vi.fn().mockResolvedValue({
        createdAt: "2026-03-31T00:00:00.000Z",
        failureStage: null,
        id: "job-1",
        kind: "observeChannel",
        note: null,
        occurredAt: "2026-03-31T00:00:00.000Z",
        payload: { channelId: "channel-1" },
        runAfter: null,
        status: "scheduled",
      } satisfies Job),
    });
    const runtimeQueue = {
      add: vi.fn(),
    };

    await runExportJob(api, runtimeQueue, { jobId: "job-1" });

    expect(runtimeQueue.add).not.toHaveBeenCalled();
    expect(api.appendJobEvent).not.toHaveBeenCalled();
  });

  it("appends update job input as-is", async () => {
    const api = createApiStub();

    await runUpdateJob(api, {
      failureStage: null,
      jobId: "job-1",
      note: null,
      occurredAt: "2026-03-31T01:00:00.000Z",
      runtimeJobId: "runtime-1",
      status: "running",
    });

    expect(api.appendJobEvent).toHaveBeenCalledWith("job-1", {
      failureStage: null,
      jobId: "job-1",
      note: null,
      occurredAt: "2026-03-31T01:00:00.000Z",
      runtimeJobId: "runtime-1",
      status: "running",
    });
  });

  it("records importing and terminal success in import job", async () => {
    const api = createApiStub();
    const applyInstruction = vi.fn().mockResolvedValue(undefined);

    await runImportJob(
      api,
      applyInstruction,
      {
        importInstructions: [{ operation: "writeAsset", payload: "{}" }],
        result: {
          failureStage: null,
          jobId: "job-1",
          jobStatus: "succeeded",
          note: null,
        },
      },
      new Date("2026-03-31T01:00:00.000Z"),
    );

    expect(api.appendJobEvent).toHaveBeenNthCalledWith(1, "job-1", {
      occurredAt: "2026-03-31T01:00:00.000Z",
      status: "importing",
    });
    expect(applyInstruction).toHaveBeenCalledWith("writeAsset", "{}");
    expect(api.appendJobEvent).toHaveBeenNthCalledWith(
      2,
      "job-1",
      expect.objectContaining({
        failureStage: null,
        status: "succeeded",
      }),
    );
  });

  it("records runtime failure through import job", async () => {
    const api = createApiStub();
    const applyInstruction = vi.fn();

    await runImportJob(api, applyInstruction, {
      importInstructions: null,
      result: {
        failureStage: "runtime",
        jobId: "job-1",
        jobStatus: "failed",
        note: "boom",
      },
    });

    expect(applyInstruction).not.toHaveBeenCalled();
    expect(api.appendJobEvent).toHaveBeenNthCalledWith(
      2,
      "job-1",
      expect.objectContaining({
        failureStage: "runtime",
        note: "boom",
        status: "failed",
      }),
    );
  });

  it("wrapper sends running and success import", async () => {
    const runtime = {
      addJob: vi.fn().mockResolvedValue(undefined),
    } satisfies JobRuntime;
    const realWorker = vi.fn().mockResolvedValue({
      importInstructions: null,
    } satisfies FunctionalJobOutput);

    const wrapped = wrapFunctionalJobWorker(realWorker, runtime);

    await wrapped({
      data: {
        context: { jobId: "job-1" },
        payload: { channelId: "channel-1" },
      },
      id: "runtime-1",
    });

    expect(runtime.addJob).toHaveBeenNthCalledWith(1, {
      kind: "update",
      payload: expect.objectContaining({
        jobId: "job-1",
        runtimeJobId: "runtime-1",
        status: "running",
      }),
    });
    expect(runtime.addJob).toHaveBeenNthCalledWith(2, {
      kind: "import",
      payload: {
        importInstructions: null,
        result: {
          failureStage: null,
          jobId: "job-1",
          jobStatus: "succeeded",
          note: null,
        },
      },
    });
  });

  it("wrapper sends failed import on exception", async () => {
    const runtime = {
      addJob: vi.fn().mockResolvedValue(undefined),
    } satisfies JobRuntime;
    const realWorker = vi.fn().mockRejectedValue(new Error("boom"));

    const wrapped = wrapFunctionalJobWorker(realWorker, runtime);

    await expect(
      wrapped({
        data: {
          context: { jobId: "job-1" },
          payload: { channelId: "channel-1" },
        },
        id: "runtime-1",
      }),
    ).rejects.toThrow("boom");

    expect(runtime.addJob).toHaveBeenNthCalledWith(2, {
      kind: "import",
      payload: {
        importInstructions: null,
        result: {
          failureStage: "runtime",
          jobId: "job-1",
          jobStatus: "failed",
          note: "boom",
        },
      },
    });
  });
});
