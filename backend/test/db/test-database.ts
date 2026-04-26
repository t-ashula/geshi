import { readFile } from "node:fs/promises";

import type { Pool } from "pg";
import { newDb } from "pg-mem";

import { createDatabaseFromPool } from "../../src/db/database.js";

export type TestDatabase = {
  database: ReturnType<typeof createDatabaseFromPool>;
  pool: Pool;
};

export async function createTestDatabase(): Promise<TestDatabase> {
  const memoryDatabase = newDb({
    autoCreateForeignKeyIndices: true,
  });
  const adapter = memoryDatabase.adapters.createPg() as unknown as {
    Pool: new () => Pool;
  };
  const pool = new adapter.Pool();
  const database = createDatabaseFromPool(pool);
  const schema = await readFile(
    new URL("../../../db/schema.sql", import.meta.url),
    "utf8",
  );

  await pool.query(schema);

  return {
    database,
    pool,
  };
}

export async function destroyTestDatabase(
  testDatabase: TestDatabase,
): Promise<void> {
  await testDatabase.database.destroy();
  await testDatabase.pool.end();
}
