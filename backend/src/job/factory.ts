import type { Pool } from "pg";

import { JobApi } from "./api.js";
import type { JobStore } from "./store.js";
import { PgJobStore } from "./store.js";

export function createJobApi(pool: Pool): JobApi {
  return new JobApi(createJobStore(pool));
}

export function createJobStore(pool: Pool): JobStore {
  return new PgJobStore(pool);
}
