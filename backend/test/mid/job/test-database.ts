import { readFile } from "node:fs/promises";

import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";

import type { GeshiDatabase } from "../../../src/db/types.js";

const SCHEMA_SQL_PATH = new URL("../../../db/schema.sql", import.meta.url);

export type TestJobDatabase = {
  db: Kysely<GeshiDatabase>;
  destroy(): Promise<void>;
  listJobEvents(jobId: string): Promise<
    Array<{
      note: string | null;
      runtime_job_id: string | null;
      status: string;
    }>
  >;
  reset(): Promise<void>;
};

export async function createTestJobDatabase(input: {
  databaseUrl: string;
  schemaName: string;
}): Promise<TestJobDatabase> {
  const adminDb = createKyselyDatabase(input.databaseUrl);

  await sql.raw(`create schema "${input.schemaName}"`).execute(adminDb);

  const db = createKyselyDatabase(input.databaseUrl, input.schemaName);
  const schemaSql = await readFile(SCHEMA_SQL_PATH, "utf8");

  await sql.raw(schemaSql).execute(db);

  return {
    db,
    async destroy() {
      await sql
        .raw(`drop schema if exists "${input.schemaName}" cascade`)
        .execute(adminDb);
      await Promise.all([db.destroy(), adminDb.destroy()]);
    },
    async listJobEvents(jobId) {
      return db
        .selectFrom("job_events")
        .select(["status", "runtime_job_id", "note"])
        .where("job_id", "=", jobId)
        .orderBy("occurred_at", "asc")
        .orderBy("id", "asc")
        .execute();
    },
    async reset() {
      await sql
        .raw("truncate table job_events, jobs restart identity cascade")
        .execute(db);
    },
  };
}

function createKyselyDatabase(
  databaseUrl: string,
  searchPath?: string,
): Kysely<GeshiDatabase> {
  const pool = new Pool({
    connectionString: databaseUrl,
    options:
      searchPath === undefined ? undefined : `-c search_path=${searchPath}`,
  });

  return new Kysely<GeshiDatabase>({
    dialect: new PostgresDialect({
      pool,
    }),
  });
}
