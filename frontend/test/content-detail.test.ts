import { describe, expect, it } from "vitest";

import {
  detailOriginalPageUrl,
  selectDetailDisplayContent,
} from "../src/content-detail.js";
import type { ContentDetailItem } from "../src/source-api.js";

describe("content detail display selection", () => {
  it("prefers detail body over summary", () => {
    expect(
      selectDetailDisplayContent(
        createDetail({
          detailBody: {
            body: "<article>Hello</article>",
            format: "html",
          },
          summary: "Summary text",
        }),
      ),
    ).toEqual({
      body: "<article>Hello</article>",
      format: "html",
      kind: "detail-body",
    });
  });

  it("falls back to summary when detail body is absent", () => {
    expect(
      selectDetailDisplayContent(
        createDetail({
          detailBody: null,
          summary: "Summary text",
        }),
      ),
    ).toEqual({
      kind: "summary",
      summary: "Summary text",
    });
  });

  it("returns null when neither detail body nor summary exists", () => {
    expect(
      selectDetailDisplayContent(
        createDetail({
          detailBody: null,
          summary: null,
        }),
      ),
    ).toBeNull();
  });
});

describe("content detail original page url", () => {
  it("prefers the primary html asset source url", () => {
    expect(
      detailOriginalPageUrl(
        createDetail({
          assets: [
            createAsset({
              kind: "html",
              primary: false,
              sourceUrl: "https://example.com/secondary",
            }),
            createAsset({
              kind: "html",
              primary: true,
              sourceUrl: "https://example.com/primary",
            }),
          ],
        }),
      ),
    ).toBe("https://example.com/primary");
  });

  it("falls back to a non-primary html asset source url", () => {
    expect(
      detailOriginalPageUrl(
        createDetail({
          assets: [
            createAsset({
              kind: "html",
              primary: false,
              sourceUrl: "https://example.com/page",
            }),
          ],
        }),
      ),
    ).toBe("https://example.com/page");
  });
});

function createDetail(
  overrides: Partial<ContentDetailItem>,
): ContentDetailItem {
  return {
    assets: [createAsset({})],
    collectedAt: "2026-05-01T00:00:00.000Z",
    detailBody: null,
    id: "content-1",
    kind: "article",
    publishedAt: "2026-05-01T00:00:00.000Z",
    source: {
      id: "source-1",
      slug: "example-source",
      title: "Example Source",
    },
    status: "stored",
    summary: null,
    title: "Example Title",
    transcripts: [],
    ...overrides,
  };
}

function createAsset(
  overrides: Partial<ContentDetailItem["assets"][number]>,
): ContentDetailItem["assets"][number] {
  return {
    byteSize: 128,
    id: "asset-1",
    kind: "audio",
    mimeType: "audio/mpeg",
    primary: true,
    sourceUrl: null,
    url: "/media/assets/asset-1.mp3",
    ...overrides,
  };
}
