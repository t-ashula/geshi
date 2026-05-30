import { describe, expect, it, vi } from "vitest";

import { createNoopLogger } from "../../src/logger/index.js";
import type { RegisteredSourceCollectorPlugin } from "../../src/plugins/index.js";
import { createSourceDiscoveryService } from "../../src/service/source-discovery-service.js";
import { assertOk } from "../support/result.js";

describe("source discovery service", () => {
  it("returns candidates from available plugin discovery results", async () => {
    const availablePlugin: Extract<
      RegisteredSourceCollectorPlugin,
      { status: "available" }
    > = {
      capability: {
        kind: "source-collector",
        sourceKind: "podcast",
      },
      definition: {
        manifest: {
          apiVersion: "1",
          capabilities: [],
          displayName: "Podcast RSS",
          pluginSlug: "podcast-rss",
        },
        plugin: {
          acquire: vi.fn(),
          discover: vi.fn(() =>
            Promise.resolve({
              candidates: [
                {
                  description: "Weekly notes",
                  sourceSlug: "example-feed",
                  title: "Example Feed",
                  url: "https://example.com/feed.xml",
                },
              ],
            }),
          ),
          extract: vi.fn(),
          inspect: vi.fn(),
          observe: vi.fn(),
          preview: vi.fn(() =>
            Promise.resolve({
              items: [],
            }),
          ),
          settingSchema: vi.fn(() => []),
          supports: vi.fn(),
        },
      },
      description: "Podcast RSS",
      displayName: "Podcast RSS",
      message: null,
      packageName: null,
      pluginSlug: "podcast-rss",
      sourceKind: "podcast",
      status: "available",
    };
    const service = createSourceDiscoveryService({
      logger: createNoopLogger(),
      sourceCollectorRegistry: {
        get: vi.fn(() => availablePlugin.definition.plugin),
        getSourceKind: vi.fn(),
        list: vi.fn(() => [
          availablePlugin,
          {
            description: null,
            displayName: "RSS",
            message: "missing dependency",
            packageName: null,
            pluginSlug: "rss",
            sourceKind: "feed" as const,
            status: "unavailable" as const,
          },
        ]),
      },
    });

    const result = await service.discoverSources({
      url: "https://example.com/feed.xml",
    });

    assertOk(result);
    expect(result.value.candidates).toEqual([
      {
        description: "Weekly notes",
        pluginSlug: "podcast-rss",
        previewAvailable: true,
        sourceKind: "podcast",
        sourceSlug: "example-feed",
        title: "Example Feed",
        url: "https://example.com/feed.xml",
      },
    ]);
  });

  it("returns preview items for a selected plugin", async () => {
    const preview = vi.fn(() =>
      Promise.resolve({
        items: [
          {
            kind: "episode",
            publishedAt: null,
            summary: "Summary",
            title: "Episode 1",
          },
        ],
      }),
    );
    const availablePlugin: Extract<
      RegisteredSourceCollectorPlugin,
      { status: "available" }
    > = {
      capability: {
        kind: "source-collector",
        sourceKind: "podcast",
      },
      definition: {
        manifest: {
          apiVersion: "1",
          capabilities: [],
          displayName: "Podcast RSS",
          pluginSlug: "podcast-rss",
        },
        plugin: {
          acquire: vi.fn(),
          extract: vi.fn(),
          inspect: vi.fn(),
          observe: vi.fn(),
          preview,
          settingSchema: vi.fn(() => []),
          supports: vi.fn(),
        },
      },
      description: "Podcast RSS",
      displayName: "Podcast RSS",
      message: null,
      packageName: null,
      pluginSlug: "podcast-rss",
      sourceKind: "podcast",
      status: "available",
    };
    const service = createSourceDiscoveryService({
      logger: createNoopLogger(),
      sourceCollectorRegistry: {
        get: vi.fn(() => availablePlugin.definition.plugin),
        getSourceKind: vi.fn(),
        list: vi.fn(() => [availablePlugin]),
      },
    });

    const result = await service.previewSource({
      pluginSlug: "podcast-rss",
      url: "https://example.com/feed.xml",
    });

    assertOk(result);
    expect(result.value.items[0]).toMatchObject({
      title: "Episode 1",
    });
  });
});
