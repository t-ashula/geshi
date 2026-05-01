import { describe, expect, it, vi } from "vitest";

import { createGetJobEndpoint } from "../../src/endpoints/api/v1/jobs.js";
import { ok } from "../../src/lib/result.js";
import type { JobService } from "../../src/service/job-service.js";
import { createTestAppDependencies } from "../support/app-dependencies.js";

describe("job endpoints", () => {
  it("returns the current job detail response", async () => {
    const endpoint = createGetJobEndpoint(
      createTestAppDependencies({
        jobService: {
          findJobById: vi.fn(() =>
            ok({
              attemptCount: 0,
              createdAt: new Date("2026-05-01T00:00:00.000Z"),
              failureMessage: null,
              finishedAt: null,
              id: "job-1",
              kind: "observe-source",
              queueJobId: "queue-1",
              retryable: true,
              sourceId: "source-1",
              startedAt: null,
              status: "queued",
            }),
          ),
        } as unknown as JobService,
      }),
    );

    await expect(endpoint("job-1")).resolves.toMatchObject(
      ok({
        id: "job-1",
        kind: "observe-source",
        status: "queued",
      }),
    );
  });
});
