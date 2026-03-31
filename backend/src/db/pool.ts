import { Pool } from "pg";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (pool !== null) {
    return pool;
  }

  pool = new Pool({
    connectionString: resolveDatabaseUrl(),
  });

  return pool;
}

function resolveDatabaseUrl(): string {
  const value = process.env.DATABASE_URL;

  if (value === undefined || value.length === 0) {
    throw new Error("DATABASE_URL is required.");
  }

  return value;
}
