import type { Pool } from "pg";

import type { JobStore } from "./store.js";
import { PgJobStore } from "./store.js";

export function createJobStore(pool: Pool): JobStore {
  return new PgJobStore(pool);
}
