import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { resolve } from "node:path";

import { serve } from "@hono/node-server";
import { Hono } from "hono";

const sourceServerPort = Number(process.env.E2E_SOURCE_SERVER_PORT ?? "3401");
const botchanAudioPath = process.env.E2E_BOTCHAN_AUDIO_PATH
  ? resolve(process.env.E2E_BOTCHAN_AUDIO_PATH)
  : null;
const botchanPlaylistDir = process.env.E2E_BOTCHAN_PLAYLIST_DIR
  ? resolve(process.env.E2E_BOTCHAN_PLAYLIST_DIR)
  : null;
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

app.get("/feeds/discovery-news.rdf", (context) => {
  const origin = new URL(context.req.url).origin;
  const entryPageUrl = `${origin}/episodes/1.html`;

  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <channel>
    <title>Geshi E2E RDF Feed</title>
    <description>Fixture RDF feed for discovery E2E tests.</description>
    <link>${origin}</link>
  </channel>
  <item>
    <title>Discovery Entry 1</title>
    <link>${entryPageUrl}</link>
    <description>Hello from RDF discovery fixture.</description>
  </item>
</rdf:RDF>`;

  return new Response(feed, {
    headers: {
      "content-type": "application/rdf+xml; charset=utf-8",
    },
  });
});

app.get("/feeds/discovery-podcast.xml", (context) => {
  const origin = new URL(context.req.url).origin;
  const episodePageUrl = `${origin}/episodes/1.html`;
  const audioUrl = `${origin}/assets/dummy.mp3`;

  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Geshi E2E Discovery Podcast</title>
    <description>Fixture podcast feed for discovery E2E tests.</description>
    <link>${origin}</link>
    <item>
      <guid>e2e-discovery-podcast-1</guid>
      <title>Discovery Episode 1</title>
      <description>Hello from podcast discovery fixture.</description>
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

app.get("/feeds/not-rss.xml", () => {
  return new Response("<html><body>not rss</body></html>", {
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
});

app.get("/feeds/botchan.xml", (context) => {
  if (botchanAudioPath === null) {
    return new Response("botchan fixture is not configured", {
      status: 500,
    });
  }

  const origin = new URL(context.req.url).origin;
  const episodePageUrl = `${origin}/episodes/1.html`;
  const audioUrl = `${origin}/assets/botchan.mp3`;

  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Geshi E2E Botchan Feed</title>
    <description>Transcript fixture feed for E2E tests.</description>
    <link>${origin}</link>
    <item>
      <guid>e2e-botchan-episode-1</guid>
      <title>Botchan Episode 1</title>
      <description>Transcript fixture episode.</description>
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

app.get("/discovery/index.html", (context) => {
  const origin = new URL(context.req.url).origin;
  const rdfUrl = `${origin}/feeds/discovery-news.rdf`;
  const podcastUrl = `${origin}/feeds/discovery-podcast.xml`;

  const body = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Geshi E2E Discovery Index</title>
    <link rel="alternate" type="application/rss+xml" title="Discovery Podcast Feed" href="${podcastUrl}" />
  </head>
  <body>
    <main>
      <h1>Discovery Samples</h1>
      <p>Fixture page exposing multiple source candidates.</p>
      <ul>
        <li><a href="${rdfUrl}">RDF discovery feed</a></li>
        <li><a href="${podcastUrl}">Podcast discovery feed</a></li>
      </ul>
    </main>
  </body>
</html>`;

  return new Response(body, {
    headers: {
      "content-type": "text/html; charset=utf-8",
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

app.get("/sources/streams/:id", (context) => {
  if (botchanPlaylistDir === null) {
    return new Response("botchan playlist fixture is not configured", {
      status: 500,
    });
  }

  const { id } = context.req.param();
  const origin = new URL(context.req.url).origin;

  return context.json({
    description: `Sample streaming fixture for ${id}.`,
    id,
    playlistUrl: `${origin}/streams/${id}.m3u8`,
    scheduledStartAt: "2026-05-05T00:00:00.000Z",
    title: `Sample Stream ${id}`,
  });
});

app.get("/streams/:fileName", async (context) => {
  if (botchanPlaylistDir === null) {
    return new Response("botchan playlist fixture is not configured", {
      status: 500,
    });
  }

  const { fileName } = context.req.param();

  if (!/^[A-Za-z0-9._-]+\.(m3u8|ts)$/.test(fileName)) {
    return new Response("not found", { status: 404 });
  }

  const filePath = resolve(botchanPlaylistDir, basename(fileName));

  try {
    const body = await readFile(filePath);

    return new Response(toArrayBuffer(body), {
      headers: {
        "content-type": fileName.endsWith(".m3u8")
          ? "application/vnd.apple.mpegurl"
          : "video/mp2t",
      },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
});

app.get("/assets/dummy.mp3", async (_context) => {
  const body = await readFixtureFile("assets/dummy.mp3");

  return new Response(toArrayBuffer(body), {
    headers: {
      "content-type": "audio/mpeg",
    },
  });
});

app.get("/assets/botchan.mp3", async (_context) => {
  if (botchanAudioPath === null) {
    return new Response("botchan fixture is not configured", {
      status: 500,
    });
  }

  const body = await readFile(botchanAudioPath);

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
