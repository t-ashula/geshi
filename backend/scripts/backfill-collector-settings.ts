import { randomUUID } from "node:crypto";

import { Pool } from "pg";

async function main(): Promise<void> {
  const pool = new Pool({
    database: process.env.PGDATABASE ?? "geshi",
    host: process.env.PGHOST ?? "127.0.0.1",
    password: process.env.PGPASSWORD ?? "geshi",
    port: Number(process.env.PGPORT ?? "55432"),
    user: process.env.PGUSER ?? "geshi",
  });
  const client = await pool.connect();

  try {
    await client.query("begin");

    const insertedCollectorSettings = await backfillCollectorSettings(client);
    const insertedCollectorSettingSnapshots =
      await backfillCollectorSettingSnapshots(client);

    await client.query("commit");

    console.log(
      JSON.stringify(
        {
          insertedCollectorSettingSnapshots,
          insertedCollectorSettings,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function backfillCollectorSettings(
  client: PoolClientLike,
): Promise<number> {
  const result = await client.query<{
    source_id: string;
  }>(
    `
      select s.id as source_id
      from sources as s
      left join collector_settings as cs
        on cs.source_id = s.id
      where cs.id is null
      order by s.created_at asc
    `,
  );

  for (const row of result.rows) {
    await client.query(
      `
        insert into collector_settings (
          id,
          source_id,
          plugin_slug
        ) values ($1, $2, $3)
      `,
      [randomUUID(), row.source_id, "podcast-rss"],
    );
  }

  return result.rowCount ?? 0;
}

async function backfillCollectorSettingSnapshots(
  client: PoolClientLike,
): Promise<number> {
  const result = await client.query<{
    collector_setting_id: string;
  }>(
    `
      select cs.id as collector_setting_id
      from collector_settings as cs
      left join collector_setting_snapshots as css
        on css.collector_setting_id = cs.id
      where css.id is null
      order by cs.created_at asc
    `,
  );

  for (const row of result.rows) {
    await client.query(
      `
        insert into collector_setting_snapshots (
          id,
          collector_setting_id,
          version,
          enabled,
          config
        ) values ($1, $2, $3, $4, $5::jsonb)
      `,
      [randomUUID(), row.collector_setting_id, 1, true, "{}"],
    );
  }

  return result.rowCount ?? 0;
}

type PoolClientLike = {
  query<T>(
    sql: string,
    parameters?: unknown[],
  ): Promise<{
    rowCount: number | null;
    rows: T[];
  }>;
};

await main();
