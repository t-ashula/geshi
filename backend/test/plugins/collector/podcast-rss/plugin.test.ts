import { readFile } from "node:fs/promises";

import { describe, expect, it, vi } from "vitest";

import { createNoopLogger } from "../../../../src/logger/index.js";
import { podcastRssPlugin } from "../../../../src/plugins/collector/podcast-rss/plugin.js";

async function observeFixture(name: string) {
  const fixture = await readFile(
    new URL(`./fixtures/${name}`, import.meta.url),
    "utf8",
  );

  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(new Response(fixture, { status: 200 }))),
  );

  const result = await podcastRssPlugin.observe({
    abortSignal: new AbortController().signal,
    config: {},
    logger: createNoopLogger(),
    sourceUrl: "https://example.com/feed.xml",
  });

  return result.contents;
}

describe("podcastRssPlugin.observe fixtures", () => {
  it("extracts html and audio assets when multiple items each have guid, shared page link, and enclosure", async () => {
    // This fixture fixes a common hosted-feed shape where each item has:
    // - guid for content identity
    // - link for the episode page
    // - enclosure for the audio asset
    const contents = await observeFixture("items-with-link-and-enclosure.xml");

    expect(contents).toHaveLength(2);
    expect(contents[0]).toMatchObject({
      externalId: "f3d85f46-60cc-40cb-a0fb-7ccd59bc8dae",
      kind: "podcast-episode",
      publishedAt: new Date("2026-04-29T09:45:00.000Z"),
      title:
        "Why Even Some Democrats Hate California’s Billionaire Tax Proposal",
    });
    expect(contents[0]?.assets).toEqual([
      expect.objectContaining({
        kind: "html",
        primary: true,
        sourceUrl: "https://www.nytimes.com/the-daily",
      }),
      expect.objectContaining({
        kind: "audio",
        primary: false,
        sourceUrl: "https://dts.podtrac.com/redirect.mp3/example-1.mp3",
      }),
    ]);
    expect(contents[1]).toMatchObject({
      externalId: "183053b7-e8f3-4c47-95b2-657d7ec3f955",
      publishedAt: new Date("2026-04-28T09:45:00.000Z"),
      title: "Assassination Attempt Suspect Charged",
    });
  });

  it("extracts only the audio asset when items have guid and enclosure but no item link", async () => {
    // This fixture fixes the case where no per-item page URL exists, so observe
    // must keep content identity from guid and avoid inventing an html asset.
    const contents = await observeFixture("items-without-link-audio-only.xml");

    expect(contents).toHaveLength(2);
    expect(contents[0]).toMatchObject({
      externalId:
        "gid://art19-episode-locator/V0/L9jEJWYYxmqXxaSRWvZ0-lpXAql3zaloEU7A8Qw8n5c",
      kind: "podcast-episode",
      publishedAt: new Date("2021-12-26T08:00:00.000Z"),
      title: "Looking Up",
    });
    expect(contents[0]?.assets).toEqual([
      expect.objectContaining({
        kind: "audio",
        primary: false,
        sourceUrl:
          "https://rss.art19.com/episodes/e2e424f9-09ee-44e8-951f-2d6dff4fc3fd.mp3",
      }),
    ]);
    expect(contents[1]).toMatchObject({
      externalId:
        "gid://art19-episode-locator/V0/HWBflwh9b-TF_zx9l2fj0AoZ5NtLcUGJCrnJLDKufgg",
      publishedAt: new Date("2021-12-12T08:00:00.000Z"),
      title: "Alex",
    });
  });
});

describe("podcastRssPlugin.observe", () => {
  it("builds observed contents from RSS items with guid, page url, and audio url", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            `<?xml version="1.0"?>
            <rss>
              <channel>
                <item>
                  <guid>ep-1</guid>
                  <title> Episode 1 </title>
                  <description> Hello </description>
                  <link> https://example.com/episodes/1 </link>
                  <enclosure url="https://cdn.example.com/audio/1.mp3" />
                  <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
                </item>
              </channel>
            </rss>`,
            { status: 200 },
          ),
        ),
      ),
    );

    const result = await podcastRssPlugin.observe({
      abortSignal: new AbortController().signal,
      config: {},
      logger: createNoopLogger(),
      sourceUrl: "https://example.com/feed.xml",
    });
    const contents = result.contents;

    expect(contents).toHaveLength(1);
    expect(contents[0]).toMatchObject({
      externalId: "ep-1",
      kind: "podcast-episode",
      publishedAt: new Date("2024-01-01T00:00:00.000Z"),
      status: "discovered",
      summary: "Hello",
      title: "Episode 1",
    });
    expect(contents[0]?.assets).toEqual([
      expect.objectContaining({
        kind: "html",
        primary: true,
        sourceUrl: "https://example.com/episodes/1",
      }),
      expect.objectContaining({
        kind: "audio",
        primary: false,
        sourceUrl: "https://cdn.example.com/audio/1.mp3",
      }),
    ]);
    expect(
      contents[0]?.contentFingerprints.every((fingerprint) =>
        /^2026-04-28:[0-9a-f]{64}$/.test(fingerprint),
      ),
    ).toBe(true);
  });

  it("falls back from guid to link and enclosure url, and skips items without identity", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            `<?xml version="1.0"?>
            <rss>
              <channel>
                <item>
                  <title>Episode from Link</title>
                  <link>https://example.com/episodes/2</link>
                </item>
                <item>
                  <title>Episode from Enclosure</title>
                  <enclosure url="https://cdn.example.com/audio/3.mp3" />
                </item>
                <item>
                  <title>Skipped</title>
                </item>
              </channel>
            </rss>`,
            { status: 200 },
          ),
        ),
      ),
    );

    const result = await podcastRssPlugin.observe({
      abortSignal: new AbortController().signal,
      config: {},
      logger: createNoopLogger(),
      sourceUrl: "https://example.com/feed.xml",
    });
    const contents = result.contents;

    expect(contents).toHaveLength(2);
    expect(contents[0]).toMatchObject({
      externalId: "https://example.com/episodes/2",
      title: "Episode from Link",
    });
    expect(contents[0]?.assets).toEqual([
      expect.objectContaining({
        kind: "html",
        primary: true,
        sourceUrl: "https://example.com/episodes/2",
      }),
    ]);
    expect(contents[1]).toMatchObject({
      externalId: "https://cdn.example.com/audio/3.mp3",
      title: "Episode from Enclosure",
    });
    expect(contents[1]?.assets).toEqual([
      expect.objectContaining({
        kind: "audio",
        primary: false,
        sourceUrl: "https://cdn.example.com/audio/3.mp3",
      }),
    ]);
  });

  it("normalizes invalid pubDate to null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            `<?xml version="1.0"?>
            <rss>
              <channel>
                <item>
                  <guid>ep-invalid-date</guid>
                  <pubDate>not-a-date</pubDate>
                </item>
              </channel>
            </rss>`,
            { status: 200 },
          ),
        ),
      ),
    );

    const result = await podcastRssPlugin.observe({
      abortSignal: new AbortController().signal,
      config: {},
      logger: createNoopLogger(),
      sourceUrl: "https://example.com/feed.xml",
    });
    const contents = result.contents;

    expect(contents).toHaveLength(1);
    expect(contents[0]?.publishedAt).toBeNull();
  });

  it("fails when RSS fetch returns a non-success status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(new Response("bad gateway", { status: 502 })),
      ),
    );

    await expect(
      podcastRssPlugin.observe({
        abortSignal: new AbortController().signal,
        config: {},
        logger: createNoopLogger(),
        sourceUrl: "https://example.com/feed.xml",
      }),
    ).rejects.toThrow("Failed to fetch RSS feed: 502");
  });
});

describe("podcastRssPlugin.inspect", () => {
  it("returns source metadata from RSS channel metadata", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            `<?xml version="1.0"?>
            <rss>
              <channel>
                <title> Example Podcast </title>
                <description> Weekly notes </description>
              </channel>
            </rss>`,
            { status: 200 },
          ),
        ),
      ),
    );

    const result = await podcastRssPlugin.inspect({
      abortSignal: new AbortController().signal,
      config: {},
      logger: createNoopLogger(),
      sourceUrl: "https://example.com/feed.xml",
    });

    expect(result).toMatchObject({
      description: "Weekly notes",
      title: "Example Podcast",
      url: "https://example.com/feed.xml",
    });
  });

  it("returns an unrecognized error for non-rss responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(new Response("<html></html>", { status: 200 })),
      ),
    );

    await expect(
      podcastRssPlugin.inspect({
        abortSignal: new AbortController().signal,
        config: {},
        logger: createNoopLogger(),
        sourceUrl: "https://example.com/feed.xml",
      }),
    ).rejects.toMatchObject({
      code: "source_inspect_unrecognized",
      message: "The given URL is not a supported RSS feed.",
    });
  });
});

describe("podcastRssPlugin.acquire", () => {
  it("downloads an asset and normalizes its content type", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(new Uint8Array([1, 2, 3]), {
            headers: {
              "content-type": "audio/mpeg; charset=binary",
            },
            status: 200,
          }),
        ),
      ),
    );

    const asset = await podcastRssPlugin.acquire({
      abortSignal: new AbortController().signal,
      asset: {
        kind: "audio",
        observedFingerprints: [
          "2026-04-28:audio:https://cdn.example.com/1.mp3",
        ],
        primary: false,
        sourceUrl: "https://cdn.example.com/1.mp3",
      },
      config: {},
      content: {
        externalId: "ep-1",
        kind: "podcast-episode",
        publishedAt: null,
        status: "discovered",
        summary: null,
        title: "Episode 1",
      },
      logger: createNoopLogger(),
    });

    expect(asset).toMatchObject({
      body: new Uint8Array([1, 2, 3]),
      contentType: "audio/mpeg",
      kind: "audio",
      primary: false,
      sourceUrl: "https://cdn.example.com/1.mp3",
    });
    expect(
      asset.acquiredFingerprints.every((fingerprint) =>
        /^2026-04-28:[0-9a-f]{64}$/.test(fingerprint),
      ),
    ).toBe(true);
  });

  it("fails when asset sourceUrl is missing", async () => {
    await expect(
      podcastRssPlugin.acquire({
        abortSignal: new AbortController().signal,
        asset: {
          kind: "audio",
          observedFingerprints: ["2026-04-28:audio:null"],
          primary: false,
          sourceUrl: null,
        },
        config: {},
        content: {
          externalId: "ep-1",
          kind: "podcast-episode",
          publishedAt: null,
          status: "discovered",
          summary: null,
          title: "Episode 1",
        },
        logger: createNoopLogger(),
      }),
    ).rejects.toThrow("Podcast RSS asset sourceUrl is required.");
  });

  it("fails when asset fetch returns a non-success status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("not found", { status: 404 }))),
    );

    await expect(
      podcastRssPlugin.acquire({
        abortSignal: new AbortController().signal,
        asset: {
          kind: "audio",
          observedFingerprints: [
            "2026-04-28:audio:https://cdn.example.com/1.mp3",
          ],
          primary: false,
          sourceUrl: "https://cdn.example.com/1.mp3",
        },
        config: {},
        content: {
          externalId: "ep-1",
          kind: "podcast-episode",
          publishedAt: null,
          status: "discovered",
          summary: null,
          title: "Episode 1",
        },
        logger: createNoopLogger(),
      }),
    ).rejects.toThrow("Failed to fetch asset: 404");
  });
});
