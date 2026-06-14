import { describe, expect, it, vi } from "vitest";

import { plugin } from "../src/index.js";

const KONNICHIWA_SHIFT_JIS = Uint8Array.from([
  0x82, 0xb1, 0x82, 0xf1, 0x82, 0xc9, 0x82, 0xbf, 0x82, 0xcd,
]);
const VERSIONED_FINGERPRINT_PATTERN = /^\d{4}-\d{2}-\d{2}:[0-9a-f]{64}$/;

function createNoopPluginLogger() {
  return {
    debug() {},
    error() {},
    info() {},
    warn() {},
  };
}

function createPluginContext() {
  return {
    getHost() {
      return {
        logger: createNoopPluginLogger(),
      };
    },
  };
}

describe("goJpRss plugin", () => {
  it("reports support only for gov-online ministry news urls", async () => {
    await expect(
      plugin.supports(
        {
          config: {},
          sourceUrl: "https://www.gov-online.go.jp/info/index.html",
        },
        createPluginContext(),
      ),
    ).resolves.toEqual({
      supported: true,
    });

    await expect(
      plugin.supports(
        {
          config: {},
          sourceUrl: "https://example.com/info/index.html",
        },
        createPluginContext(),
      ),
    ).resolves.toEqual({
      supported: false,
    });
  });

  it("inspects gov-online metadata", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            `<html>
              <head>
                <title>各府省の新着情報 | 政府広報オンライン</title>
                <meta
                  name="description"
                  content="各府省ウェブサイトに公表された重要な政策や政府からのお知らせをとりまとめ、分かりやすく紹介しています。"
                />
              </head>
            </html>`,
            { status: 200 },
          ),
        ),
      ),
    );

    await expect(
      plugin.inspect(
        {
          abortSignal: new AbortController().signal,
          config: {},
          sourceUrl: "https://www.gov-online.go.jp/info/index.html",
        },
        createPluginContext(),
      ),
    ).resolves.toEqual({
      description:
        "各府省ウェブサイトに公表された重要な政策や政府からのお知らせをとりまとめ、分かりやすく紹介しています。",
      title: "各府省の新着情報",
      url: "https://www.gov-online.go.jp/info/index.html",
    });
  });

  it("inspects shift_jis gov-online metadata using meta charset", async () => {
    const body = joinBytes([
      asciiBytes('<html><head><meta charset="Shift_JIS" /><title>'),
      KONNICHIWA_SHIFT_JIS,
      asciiBytes("</title></head></html>"),
    ]);

    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(Buffer.from(body), {
            headers: {
              "content-type": "text/html",
            },
            status: 200,
          }),
        ),
      ),
    );

    await expect(
      plugin.inspect(
        {
          abortSignal: new AbortController().signal,
          config: {},
          sourceUrl: "https://www.gov-online.go.jp/info/index.html",
        },
        createPluginContext(),
      ),
    ).resolves.toEqual({
      description: null,
      title: "こんにちは",
      url: "https://www.gov-online.go.jp/info/index.html",
    });
  });

  it("rejects unsupported source urls", async () => {
    await expect(
      plugin.inspect(
        {
          abortSignal: new AbortController().signal,
          config: {},
          sourceUrl: "https://example.com/info/index.html",
        },
        createPluginContext(),
      ),
    ).rejects.toMatchObject({
      code: "source_inspect_unsupported",
    });
  });

  it("observes gov-online entries across pages and stops at lastProcessedUrl", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            `<html>
              <body>
                <ul class="p-newsList">
                  <li class="p-newsList__item">
                    <div class="p-newsList__meta">
                      <span class="p-newsList__categoryLabel">内閣府</span>
                      <time class="p-newsList__date" datetime="2099-05-23">2099年5月23日</time>
                    </div>
                    <a class="p-newsList__link" href="https://example.go.jp/news/1">
                      <span class="p-newsList__title">記事1</span>
                    </a>
                  </li>
                  <li class="p-newsList__item">
                    <div class="p-newsList__meta">
                      <span class="p-newsList__categoryLabel">総務省</span>
                      <time class="p-newsList__date" datetime="2099-05-22">2099年5月22日</time>
                    </div>
                    <a class="p-newsList__link" href="https://example.go.jp/news/2">
                      <span class="p-newsList__title">記事2</span>
                    </a>
                  </li>
                </ul>
                <div class="p-pagination__next">
                  <a href="/info/index.html?_filter=ministry_news&amp;offset=20">次へ</a>
                </div>
              </body>
            </html>`,
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            `<html>
              <body>
                <ul class="p-newsList">
                  <li class="p-newsList__item">
                    <div class="p-newsList__meta">
                      <span class="p-newsList__categoryLabel">環境省</span>
                      <time class="p-newsList__date" datetime="2099-05-21">2099年5月21日</time>
                    </div>
                    <a class="p-newsList__link" href="https://example.go.jp/news/3">
                      <span class="p-newsList__title">記事3</span>
                    </a>
                  </li>
                  <li class="p-newsList__item">
                    <div class="p-newsList__meta">
                      <span class="p-newsList__categoryLabel">外務省</span>
                      <time class="p-newsList__date" datetime="2099-05-20">2099年5月20日</time>
                    </div>
                    <a class="p-newsList__link" href="https://example.go.jp/news/4">
                      <span class="p-newsList__title">記事4</span>
                    </a>
                  </li>
                </ul>
              </body>
            </html>`,
            { status: 200 },
          ),
        ),
    );

    const observed = await plugin.observe(
      {
        abortSignal: new AbortController().signal,
        collectorPluginState: {
          lastProcessedUrl: "https://example.go.jp/news/4",
        },
        config: {},
        sourceUrl: "https://www.gov-online.go.jp/info/index.html",
      },
      createPluginContext(),
    );

    expect(observed.collectorPluginState).toEqual({
      lastProcessedUrl: "https://example.go.jp/news/1",
    });
    expect(observed.contents).toHaveLength(3);
    expect(observed.contents.map((item) => item.externalId)).toEqual([
      "https://example.go.jp/news/1",
      "https://example.go.jp/news/2",
      "https://example.go.jp/news/3",
    ]);
    expect(observed.contents[0]).toMatchObject({
      kind: "article",
      publishedAt: new Date("2099-05-23T00:00:00Z"),
      summary: "2099年5月23日 内閣府 記事1",
      title: "記事1",
    });
    expect(observed.contents[0]?.assets).toEqual([
      expect.objectContaining({
        kind: "html",
        nextAction: {
          actionKind: "acquire",
        },
        primary: true,
        sourceUrl: "https://example.go.jp/news/1",
      }),
    ]);
    expect(observed.contents[0]?.contentFingerprints).toEqual([
      expect.stringMatching(VERSIONED_FINGERPRINT_PATTERN),
      "content-url:https://example.go.jp/news/1",
    ]);
    expect(observed.contents[0]?.assets[0]?.observedFingerprints).toEqual([
      expect.stringMatching(VERSIONED_FINGERPRINT_PATTERN),
      "observed-html-url:https://example.go.jp/news/1",
    ]);
  });

  it("stops observing when entries are older than one week", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-02T00:00:00Z"));

    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            `<html>
              <body>
                <ul class="p-newsList">
                  <li class="p-newsList__item">
                    <div class="p-newsList__meta">
                      <span class="p-newsList__categoryLabel">内閣府</span>
                      <time class="p-newsList__date" datetime="2026-05-01">2026年5月1日</time>
                    </div>
                    <a class="p-newsList__link" href="https://example.go.jp/news/recent">
                      <span class="p-newsList__title">新しい記事</span>
                    </a>
                  </li>
                  <li class="p-newsList__item">
                    <div class="p-newsList__meta">
                      <span class="p-newsList__categoryLabel">総務省</span>
                      <time class="p-newsList__date" datetime="2026-04-20">2026年4月20日</time>
                    </div>
                    <a class="p-newsList__link" href="https://example.go.jp/news/old">
                      <span class="p-newsList__title">古い記事</span>
                    </a>
                  </li>
                </ul>
                <div class="p-pagination__next">
                  <a href="/info/index.html?_filter=ministry_news&amp;offset=20">次へ</a>
                </div>
              </body>
            </html>`,
            { status: 200 },
          ),
        ),
      ),
    );

    const observed = await plugin.observe(
      {
        abortSignal: new AbortController().signal,
        config: {},
        sourceUrl: "https://www.gov-online.go.jp/info/index.html",
      },
      createPluginContext(),
    );

    expect(observed.collectorPluginState).toEqual({
      lastProcessedUrl: "https://example.go.jp/news/recent",
    });
    expect(observed.contents).toHaveLength(1);
    expect(observed.contents[0]?.externalId).toBe(
      "https://example.go.jp/news/recent",
    );
    expect(observed.contents[0]?.assets).toEqual([
      expect.objectContaining({
        kind: "html",
        nextAction: {
          actionKind: "acquire",
        },
        primary: true,
        sourceUrl: "https://example.go.jp/news/recent",
      }),
    ]);

    vi.useRealTimers();
  });

  it("deduplicates entries by canonicalized article url", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            `<html>
              <body>
                <ul class="p-newsList">
                  <li class="p-newsList__item">
                    <div class="p-newsList__meta">
                      <span class="p-newsList__categoryLabel">デジタル庁</span>
                      <time class="p-newsList__date" datetime="2099-05-23">2099年5月23日</time>
                    </div>
                    <a
                      class="p-newsList__link"
                      href="https://example.go.jp/news/1?utm_source=gov-online#top"
                    >
                      <span class="p-newsList__title">記事1</span>
                    </a>
                  </li>
                </ul>
                <div class="p-pagination__next">
                  <a href="/info/index.html?_filter=ministry_news&amp;offset=20">次へ</a>
                </div>
              </body>
            </html>`,
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            `<html>
              <body>
                <ul class="p-newsList">
                  <li class="p-newsList__item">
                    <div class="p-newsList__meta">
                      <span class="p-newsList__categoryLabel">デジタル庁</span>
                      <time class="p-newsList__date" datetime="2099-05-23">2099年5月23日</time>
                    </div>
                    <a class="p-newsList__link" href="https://example.go.jp/news/1">
                      <span class="p-newsList__title">記事1</span>
                    </a>
                  </li>
                </ul>
              </body>
            </html>`,
            { status: 200 },
          ),
        ),
    );

    const observed = await plugin.observe(
      {
        abortSignal: new AbortController().signal,
        config: {},
        sourceUrl: "https://www.gov-online.go.jp/info/index.html",
      },
      createPluginContext(),
    );

    expect(observed.collectorPluginState).toEqual({
      lastProcessedUrl: "https://example.go.jp/news/1",
    });
    expect(observed.contents).toHaveLength(1);
    expect(observed.contents[0]?.externalId).toBe(
      "https://example.go.jp/news/1",
    );
    expect(observed.contents[0]?.contentFingerprints).toEqual([
      expect.stringMatching(VERSIONED_FINGERPRINT_PATTERN),
      "content-url:https://example.go.jp/news/1",
    ]);
    expect(observed.contents[0]?.assets).toEqual([
      expect.objectContaining({
        observedFingerprints: [
          expect.stringMatching(VERSIONED_FINGERPRINT_PATTERN),
          "observed-html-url:https://example.go.jp/news/1",
        ],
        sourceUrl: "https://example.go.jp/news/1",
      }),
    ]);
  });

  it("acquires HTML assets", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response("<html><body>entry</body></html>", {
            headers: {
              "content-type": "text/html; charset=utf-8",
            },
            status: 200,
          }),
        ),
      ),
    );

    const asset = await plugin.acquire(
      {
        abortSignal: new AbortController().signal,
        asset: {
          kind: "html",
          nextAction: {
            actionKind: "acquire",
          },
          observedFingerprints: [
            "2026-05-13:1111111111111111111111111111111111111111111111111111111111111111",
          ],
          primary: true,
          sourceUrl: "https://example.go.jp/news/1",
        },
        config: {},
        content: {
          externalId: "https://example.go.jp/news/1",
          kind: "article",
          publishedAt: null,
          status: "discovered",
          summary: null,
          title: "記事1",
        },
      },
      createPluginContext(),
    );

    expect(asset.contentType).toBe("text/html");
    expect(asset.kind).toBe("html");
    if (asset.body === undefined) {
      throw new Error("Expected acquired asset body.");
    }
    expect(asset.body.byteLength).toBeGreaterThan(0);
    expect(asset.acquiredFingerprints).toEqual([
      expect.stringMatching(VERSIONED_FINGERPRINT_PATTERN),
      "acquired-html:https://example.go.jp/news/1:31",
    ]);
  });

  it("acquires shift_jis HTML assets without rewriting bytes", async () => {
    const body = joinBytes([
      asciiBytes("<html><body><p>"),
      KONNICHIWA_SHIFT_JIS,
      asciiBytes("</p></body></html>"),
    ]);

    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(Buffer.from(body), {
            headers: {
              "content-type": "text/html; charset=Shift_JIS",
            },
            status: 200,
          }),
        ),
      ),
    );

    const asset = await plugin.acquire(
      {
        abortSignal: new AbortController().signal,
        asset: {
          kind: "html",
          nextAction: {
            actionKind: "acquire",
          },
          observedFingerprints: [
            "2026-05-13:2222222222222222222222222222222222222222222222222222222222222222",
          ],
          primary: true,
          sourceUrl: "https://example.go.jp/news/shift-jis",
        },
        config: {},
        content: {
          externalId: "https://example.go.jp/news/shift-jis",
          kind: "article",
          publishedAt: null,
          status: "discovered",
          summary: null,
          title: "shift-jis",
        },
      },
      createPluginContext(),
    );

    if (asset.body === undefined) {
      throw new Error("Expected acquired asset body.");
    }

    expect(asset.body).toEqual(body);
    expect(asset.contentType).toBe("text/html");
    expect(asset.acquiredFingerprints).toEqual([
      expect.stringMatching(VERSIONED_FINGERPRINT_PATTERN),
      "acquired-html:https://example.go.jp/news/shift-jis:43",
    ]);
  });
  it("extracts a sanitized html detail body", async () => {
    await expect(
      plugin.extract(
        {
          asset: {
            body: new TextEncoder().encode(
              `
                <html>
                  <body>
                    <main class="article-body">
                      <h1>記事タイトル</h1>
                      <p>本文 <strong>その1</strong></p>
                      <div>
                        <p><a href="/info/example.html">詳細ページ</a></p>
                      </div>
                      <style>.hidden { display: none; }</style>
                    </main>
                  </body>
                </html>
              `,
            ),
            kind: "html",
            mimeType: "text/html",
            sourceUrl: "https://www.gov-online.go.jp/example.html",
          },
        },
        createPluginContext(),
      ),
    ).resolves.toEqual({
      body: '<article><h1>記事タイトル</h1><p>本文 <strong>その1</strong></p><p><a href="https://www.gov-online.go.jp/info/example.html">詳細ページ</a></p></article>',
      format: "html",
    });
  });

  it("extracts shift_jis html using meta charset", async () => {
    const body = joinBytes([
      asciiBytes(`
              <html>
                <head>
                  <meta charset="Shift_JIS" />
                </head>
                <body>
                  <main class="article-body">
                    <p>`),
      KONNICHIWA_SHIFT_JIS,
      asciiBytes(`</p>
                  </main>
                </body>
              </html>
            `),
    ]);

    await expect(
      plugin.extract(
        {
          asset: {
            body,
            kind: "html",
            mimeType: "text/html",
            sourceUrl: "https://www.gov-online.go.jp/example.html",
          },
        },
        createPluginContext(),
      ),
    ).resolves.toEqual({
      body: "<article><p>こんにちは</p></article>",
      format: "html",
    });
  });
});

function asciiBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function joinBytes(chunks: Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return result;
}
