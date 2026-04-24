import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createJobStore } from "../../../src/job/index.js";
import type { TestJobDatabase } from "./test-database.js";
import { createTestJobDatabase } from "./test-database.js";

const DEFAULT_TEST_DATABASE_URL = "postgres://geshi:geshi@127.0.0.1:15432/geshi";

describe("PgJobStore (mid)", () => {
  const schemaName = `mid_${randomUUID().replaceAll("-", "_")}`;
  const baseDatabaseUrl =
    process.env.TEST_DATABASE_URL ??
    process.env.DATABASE_URL ??
    DEFAULT_TEST_DATABASE_URL;

  let testDatabase: TestJobDatabase | null = null;

  beforeAll(async () => {
    testDatabase = await createTestJobDatabase({
      databaseUrl: baseDatabaseUrl,
      schemaName,
    });
  });

  beforeEach(async () => {
    await testDatabase!.reset();
  });

  afterAll(async () => {
    if (testDatabase !== null) {
      await testDatabase.destroy();
    }
  });

  it("creates a job with registered current state", async () => {
    const store = createJobStore({
      kind: "pg",
      options: {
        databaseUrl: baseDatabaseUrl,
        searchPath: schemaName,
      },
    });

    const job = await store.createJob({
      createdAt: "2026-03-31T00:00:00.000Z",
      id: "0195f3d5-0000-7000-8000-000000000001",
      kind: "observeChannel",
      payload: { channelId: "channel-1" },
      runAfter: null,
    });

    expect(job).toMatchObject({
      failureStage: null,
      id: "0195f3d5-0000-7000-8000-000000000001",
      kind: "observeChannel",
      note: null,
      occurredAt: "2026-03-31T00:00:00.000Z",
      payload: { channelId: "channel-1" },
      runAfter: null,
      status: "registered",
    });
  });

  it("appends an event and reflects latest state in getJob/listJobs", async () => {
    const store = createJobStore({
      kind: "pg",
      options: {
        databaseUrl: baseDatabaseUrl,
        searchPath: schemaName,
      },
    });

    await store.createJob({
      createdAt: "2026-03-31T00:00:00.000Z",
      id: "0195f3d5-0000-7000-8000-000000000002",
      kind: "observeChannel",
      payload: { channelId: "channel-1" },
      runAfter: null,
    });

    await store.appendJobEvent({
      failureStage: null,
      jobId: "0195f3d5-0000-7000-8000-000000000002",
      note: null,
      occurredAt: "2026-03-31T00:00:01.000Z",
      runtimeJobId: "runtime-1",
      status: "queued",
    });

    const job = await store.getJob("0195f3d5-0000-7000-8000-000000000002");
    const jobs = await store.listJobs();

    expect(job).toMatchObject({
      failureStage: null,
      id: "0195f3d5-0000-7000-8000-000000000002",
      note: null,
      occurredAt: "2026-03-31T00:00:01.000Z",
      status: "queued",
    });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      id: "0195f3d5-0000-7000-8000-000000000002",
      occurredAt: "2026-03-31T00:00:01.000Z",
      status: "queued",
    });
  });
});
