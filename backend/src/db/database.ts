import { Kysely, PostgresDialect } from "kysely";
import type { Pool } from "pg";

import type { GeshiDatabase } from "./types.js";

export function createDatabaseFromPool(pool: Pool): Kysely<GeshiDatabase> {
  return new Kysely<GeshiDatabase>({
    dialect: new PostgresDialect({
      pool,
    }),
  });
}
