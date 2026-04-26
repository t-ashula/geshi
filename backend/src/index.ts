import { serve } from "@hono/node-server";
import { Pool } from "pg";

import { createApp } from "./app.js";
import { createDatabaseFromPool } from "./db/database.js";
import { SourceRepository } from "./db/source-repository.js";
import { SourceService } from "./service/source-service.js";

const port = Number(process.env.PORT ?? "3000");
const pool = new Pool({
  database: process.env.PGDATABASE ?? "geshi",
  host: process.env.PGHOST ?? "127.0.0.1",
  password: process.env.PGPASSWORD ?? "geshi",
  port: Number(process.env.PGPORT ?? "55432"),
  user: process.env.PGUSER ?? "geshi",
});
const database = createDatabaseFromPool(pool);
const sourceRepository = new SourceRepository(database);
const sourceService = new SourceService(sourceRepository);
const app = createApp(sourceService);

serve({
  fetch: app.fetch,
  port,
});
