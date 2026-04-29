import { afterEach, describe, expect, it, vi } from "vitest";

import { inspectSource } from "../src/source-api.js";

describe("inspectSource", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns inspect data on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                description: "Weekly notes",
                sourceSlug: "example-podcast-123456789abc",
                title: "Example Podcast",
                url: "https://example.com/feed.xml",
              },
            }),
            {
              headers: {
                "content-type": "application/json",
              },
              status: 200,
            },
          ),
        ),
      ),
    );

    await expect(
      inspectSource({
        url: "https://example.com/feed.xml",
      }),
    ).resolves.toEqual({
      ok: true,
      value: {
        description: "Weekly notes",
        sourceSlug: "example-podcast-123456789abc",
        title: "Example Podcast",
        url: "https://example.com/feed.xml",
      },
    });
  });

  it("returns an inspect error on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              error: {
                code: "source_inspect_unrecognized",
                message: "The given URL is not a supported RSS feed.",
              },
            }),
            {
              headers: {
                "content-type": "application/json",
              },
              status: 422,
            },
          ),
        ),
      ),
    );

    await expect(
      inspectSource({
        url: "https://example.com/feed.xml",
      }),
    ).resolves.toEqual({
      error: {
        code: "source_inspect_unrecognized",
        message: "The given URL is not a supported RSS feed.",
      },
      ok: false,
    });
  });
});
