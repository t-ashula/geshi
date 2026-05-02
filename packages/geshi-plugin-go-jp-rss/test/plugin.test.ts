import { describe, expect, it, vi } from "vitest";

import { plugin } from "../src/index.js";

describe("goJpRss plugin", () => {
  it("reports support only for gov-online ministry news urls", async () => {
    await expect(
      plugin.supports({
        config: {},
        logger: createNoopPluginLogger(),
        sourceUrl: "https://www.gov-online.go.jp/info/index.html",
      }),
    ).resolves.toEqual({
      supported: true,
    });

    await expect(
      plugin.supports({
        config: {},
        logger: createNoopPluginLogger(),
        sourceUrl: "https://example.com/info/index.html",
      }),
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
      plugin.inspect({
        abortSignal: new AbortController().signal,
        config: {},
        logger: createNoopPluginLogger(),
        sourceUrl: "https://www.gov-online.go.jp/info/index.html",
      }),
    ).resolves.toEqual({
      description:
        "各府省ウェブサイトに公表された重要な政策や政府からのお知らせをとりまとめ、分かりやすく紹介しています。",
      title: "各府省の新着情報",
      url: "https://www.gov-online.go.jp/info/index.html",
    });
  });

  it("rejects unsupported source urls", async () => {
    await expect(
      plugin.inspect({
        abortSignal: new AbortController().signal,
        config: {},
        logger: createNoopPluginLogger(),
        sourceUrl: "https://example.com/info/index.html",
      }),
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

    const observed = await plugin.observe({
      abortSignal: new AbortController().signal,
      collectorPluginState: {
        lastProcessedUrl: "https://example.go.jp/news/4",
      },
      config: {},
      logger: createNoopPluginLogger(),
      sourceUrl: "https://www.gov-online.go.jp/info/index.html",
    });

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

    const observed = await plugin.observe({
      abortSignal: new AbortController().signal,
      config: {},
      logger: createNoopPluginLogger(),
      sourceUrl: "https://www.gov-online.go.jp/info/index.html",
    });

    expect(observed.collectorPluginState).toEqual({
      lastProcessedUrl: "https://example.go.jp/news/recent",
    });
    expect(observed.contents).toHaveLength(1);
    expect(observed.contents[0]?.externalId).toBe(
      "https://example.go.jp/news/recent",
    );

    vi.useRealTimers();
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

    const asset = await plugin.acquire({
      abortSignal: new AbortController().signal,
      asset: {
        kind: "html",
        observedFingerprints: [
          "observed-html-url:https://example.go.jp/news/1",
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
      logger: createNoopPluginLogger(),
    });

    expect(asset.contentType).toBe("text/html");
    expect(asset.kind).toBe("html");
    expect(asset.body.byteLength).toBeGreaterThan(0);
  });
});

function createNoopPluginLogger() {
  return {
    debug() {},
    error() {},
    info() {},
    warn() {},
  };
}
