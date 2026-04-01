import { describe, expect, it, vi } from "vitest";

import { createHealthCheckWorker } from "../../../../src/job/index.js";

describe("HealthCheck worker", () => {
  it("logs and returns successful functional output", async () => {
    const logger = {
      child: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    };
    const worker = createHealthCheckWorker({ logger });

    const output = await worker({ jobId: "job-1" }, { testRunId: "test-run-1" });

    expect(logger.info).toHaveBeenCalledWith("HealthCheck worker reached.", {
      jobId: "job-1",
      testRunId: "test-run-1",
    });
    expect(logger.debug).toHaveBeenCalledWith("HealthCheck worker payload.", {
      jobId: "job-1",
      payload: { testRunId: "test-run-1" },
    });
    expect(output).toEqual({
      importInstructions: null,
      note: "HealthCheck completed",
    });
  });
});
