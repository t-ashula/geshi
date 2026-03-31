import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createJobStore } from "../../../src/job/index.js";

const DEFAULT_TEST_DATABASE_URL = "postgres://geshi:geshi@127.0.0.1:5432/geshi";
const SCHEMA_SQL_PATH = new URL("../../../db/schema.sql", import.meta.url);

describe("PgJobStore (mid)", () => {
  const schemaName = `mid_${randomUUID().replaceAll("-", "_")}`;
  const baseDatabaseUrl =
    process.env.TEST_DATABASE_URL ??
    process.env.DATABASE_URL ??
    DEFAULT_TEST_DATABASE_URL;

  let adminPool: Pool | null = null;
  let storePool: Pool | null = null;

  beforeAll(async () => {
    adminPool = new Pool({
      connectionString: baseDatabaseUrl,
    });

    await adminPool.query(`create schema "${schemaName}"`);

    storePool = new Pool({
      connectionString: baseDatabaseUrl,
      options: `-c search_path=${schemaName}`,
    });

    const schemaSql = await readFile(SCHEMA_SQL_PATH, "utf8");
    await storePool.query(schemaSql);
  });

  beforeEach(async () => {
    await storePool!.query(
      "truncate table job_events, jobs restart identity cascade",
    );
  });

  afterAll(async () => {
    if (storePool !== null) {
      await storePool.end();
    }

    if (adminPool !== null) {
      await adminPool.query(`drop schema if exists "${schemaName}" cascade`);
      await adminPool.end();
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
