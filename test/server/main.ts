import { readFile } from "node:fs/promises";

import { serve } from "@hono/node-server";
import { Hono } from "hono";

const sourceServerPort = Number(process.env.E2E_SOURCE_SERVER_PORT ?? "3401");
const app = new Hono();

app.get("/feeds/podcast.xml", (context) => {
  const origin = new URL(context.req.url).origin;
  const episodePageUrl = `${origin}/episodes/1.html`;
  const audioUrl = `${origin}/assets/dummy.mp3`;

  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Geshi E2E Feed</title>
    <description>Fixture feed for E2E tests.</description>
    <link>${origin}</link>
    <item>
      <guid>e2e-episode-1</guid>
      <title>Episode 1</title>
      <description>Hello from E2E fixture.</description>
      <link>${episodePageUrl}</link>
      <enclosure url="${audioUrl}" type="audio/mpeg" />
      <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

  return new Response(feed, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
    },
  });
});

app.get("/episodes/1.html", async (_context) => {
  const body = await readFixtureText("episodes/1.html");

  return new Response(body, {
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
});

app.get("/assets/dummy.mp3", async (_context) => {
  const body = await readFixtureFile("assets/dummy.mp3");

  return new Response(toArrayBuffer(body), {
    headers: {
      "content-type": "audio/mpeg",
    },
  });
});

serve({
  fetch: app.fetch,
  port: sourceServerPort,
});

async function readFixtureFile(relativePath: string): Promise<Buffer> {
  return readFile(new URL(`./static/${relativePath}`, import.meta.url));
}

async function readFixtureText(relativePath: string): Promise<string> {
  return readFile(new URL(`./static/${relativePath}`, import.meta.url), "utf8");
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
}
