import { serve } from "@hono/node-server";

import { createApp } from "./app.js";

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = "127.0.0.1";

function resolveHost(value: string | undefined): string {
  if (value === undefined || value.length === 0) {
    return DEFAULT_HOST;
  }

  return value;
}

function resolvePort(value: string | undefined): number {
  const port = Number.parseInt(value ?? "", 10);

  if (value === undefined) {
    return DEFAULT_PORT;
  }

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid PORT: ${value}`);
  }

  return port;
}

const host = resolveHost(process.env.HOST);
const port = resolvePort(process.env.PORT);
const app = createApp();

serve(
  {
    fetch: app.fetch,
    hostname: host,
    port,
  },
  (info) => {
    process.stdout.write(
      `Geshi backend listening on http://${host}:${info.port}\n`,
    );
  },
);
