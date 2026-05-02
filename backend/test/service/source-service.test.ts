import { describe, expect, it, vi } from "vitest";

import type {
  CreateSourceInput,
  ObserveSourceTarget,
  PeriodicCrawlSourceTarget,
  SourceListItem,
  SourceRepository,
} from "../../src/db/source-repository.js";
import { err, ok } from "../../src/lib/result.js";
import {
  createSourceService,
  normalizeSourceUrl,
} from "../../src/service/source-service.js";
import { assertErr, assertOk } from "../support/result.js";

const sourceCollectorRegistry = {
  get: vi.fn((pluginSlug: string) => ({
    acquire: vi.fn(),
    inspect: vi.fn(),
    observe: vi.fn(),
    pluginSlug,
    sourceKind:
      pluginSlug === "go-jp-rss" ? ("feed" as const) : ("podcast" as const),
  })),
};

describe("source service", () => {
  it("rejects blank source urls", () => {
    expect(normalizeSourceUrl("   ")).toEqual({
      error: {
        code: "source_url_required",
        message: "Source URL is required.",
      },
      ok: false,
    });
  });

  it("normalizes input and delegates source creation", async () => {
    const createSource = vi.fn((input: CreateSourceInput) =>
      Promise.resolve(
        ok({
          collectorSettingsVersion: 1,
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          description: input.description ?? null,
          id: "source-1",
          kind: "podcast",
          periodicCrawlEnabled: true,
          periodicCrawlIntervalMinutes: 60,
          recordedAt: null,
          slug: input.slug,
          title: input.title ?? null,
          url: input.url,
          urlHash: input.urlHash,
          version: 1,
        } satisfies SourceListItem),
      ),
    );
    const service = createSourceService(
      {
        createSource,
        findObserveSourceTarget: vi.fn(),
        listPeriodicCrawlTargets: vi.fn(),
        listSources: vi.fn(),
        updateSourceCollectorSettings: vi.fn(),
      } as unknown as SourceRepository,
      sourceCollectorRegistry,
    );

    const result = await service.createSource({
      description: "  Weekly notes  ",
      title: " Example Feed ",
      url: " https://example.com/feed.xml ",
    });
    const createSourceInput = createSource.mock.calls[0]?.[0];

    expect(result.ok).toBe(true);
    expect(createSource).toHaveBeenCalledTimes(1);
    expect(createSourceInput).toMatchObject({
      description: "Weekly notes",
      kind: "podcast",
      pluginSlug: "podcast-rss",
      title: "Example Feed",
      url: "https://example.com/feed.xml",
    });
    expect(createSourceInput?.slug).toMatch(/^example-feed/);
  });

  it("rejects non-http source urls", () => {
    expect(normalizeSourceUrl("ftp://example.com/feed.xml")).toEqual({
      error: {
        code: "source_url_invalid",
        message: "Source URL must be an absolute http or https URL.",
      },
      ok: false,
    });
  });

  it("passes through repository errors while creating sources", async () => {
    const service = createSourceService(
      {
        createSource: vi.fn(() =>
          Promise.resolve(err(new Error("create failed"))),
        ),
        findObserveSourceTarget: vi.fn(),
        listPeriodicCrawlTargets: vi.fn(),
        listSources: vi.fn(),
        updateSourceCollectorSettings: vi.fn(),
      } as unknown as SourceRepository,
      sourceCollectorRegistry,
    );

    const result = await service.createSource({
      url: "https://example.com/feed.xml",
    });

    assertErr(result);
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error.message).toBe("create failed");
  });

  it("maps missing observe targets to source_not_found", async () => {
    const service = createSourceService(
      {
        createSource: vi.fn(),
        findObserveSourceTarget: vi.fn(() => Promise.resolve(ok(null))),
        listPeriodicCrawlTargets: vi.fn(),
        listSources: vi.fn(),
        updateSourceCollectorSettings: vi.fn(),
      } as unknown as SourceRepository,
      sourceCollectorRegistry,
    );

    const result = await service.findObserveSourceTarget("missing");

    assertErr(result);
    expect(result.error).toEqual({
      code: "source_not_found",
      message: "Source not found.",
    });
  });

  it("returns observe targets from repository", async () => {
    const target = {
      collectorSettingId: "collector-1",
      collectorSettingSnapshotId: "snapshot-1",
      config: {},
      crawlEnabled: true,
      crawlIntervalMinutes: 60,
      pluginSlug: "podcast-rss",
      slug: "example-feed",
      sourceId: "source-1",
      sourceKind: "podcast",
      url: "https://example.com/feed.xml",
    } satisfies ObserveSourceTarget;
    const service = createSourceService(
      {
        createSource: vi.fn(),
        findObserveSourceTarget: vi.fn(() => Promise.resolve(ok(target))),
        listPeriodicCrawlTargets: vi.fn(),
        listSources: vi.fn(),
        updateSourceCollectorSettings: vi.fn(),
      } as unknown as SourceRepository,
      sourceCollectorRegistry,
    );

    const result = await service.findObserveSourceTarget("source-1");

    assertOk(result);
    expect(result.value).toEqual(target);
  });

  it("passes through repository errors while finding observe targets", async () => {
    const service = createSourceService(
      {
        createSource: vi.fn(),
        findObserveSourceTarget: vi.fn(() =>
          Promise.resolve(err(new Error("lookup failed"))),
        ),
        listPeriodicCrawlTargets: vi.fn(),
        listSources: vi.fn(),
        updateSourceCollectorSettings: vi.fn(),
      } as unknown as SourceRepository,
      sourceCollectorRegistry,
    );

    const result = await service.findObserveSourceTarget("source-1");

    assertErr(result);
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error.message).toBe("lookup failed");
  });

  it("lists periodic crawl targets from repository", async () => {
    const targets = [
      {
        collectorConfig: {},
        collectorSettingId: "collector-1",
        collectorSettingSnapshotId: "snapshot-1",
        sourceId: "source-1",
      },
    ] as unknown as PeriodicCrawlSourceTarget[];
    const service = createSourceService(
      {
        createSource: vi.fn(),
        findObserveSourceTarget: vi.fn(),
        listPeriodicCrawlTargets: vi.fn(() => Promise.resolve(ok(targets))),
        listSources: vi.fn(),
        updateSourceCollectorSettings: vi.fn(),
      } as unknown as SourceRepository,
      sourceCollectorRegistry,
    );

    const result = await service.listPeriodicCrawlTargets();

    assertOk(result);
    expect(result.value).toEqual(targets);
  });

  it("lists sources from repository", async () => {
    const sources = [
      {
        collectorSettingsVersion: 1,
        createdAt: new Date("2026-05-01T00:00:00.000Z"),
        description: null,
        id: "source-1",
        kind: "podcast",
        periodicCrawlEnabled: true,
        periodicCrawlIntervalMinutes: 60,
        recordedAt: null,
        slug: "example-feed",
        title: "Example Feed",
        url: "https://example.com/feed.xml",
        urlHash: "hash-1",
        version: 1,
      },
    ] satisfies SourceListItem[];
    const service = createSourceService(
      {
        createSource: vi.fn(),
        findObserveSourceTarget: vi.fn(),
        listPeriodicCrawlTargets: vi.fn(),
        listSources: vi.fn(() => Promise.resolve(ok(sources))),
        updateSourceCollectorSettings: vi.fn(),
      } as unknown as SourceRepository,
      sourceCollectorRegistry,
    );

    const result = await service.listSources();

    assertOk(result);
    expect(result.value).toEqual(sources);
  });

  it("maps missing collector settings updates to source_not_found", async () => {
    const service = createSourceService(
      {
        createSource: vi.fn(),
        findObserveSourceTarget: vi.fn(),
        listPeriodicCrawlTargets: vi.fn(),
        listSources: vi.fn(),
        updateSourceCollectorSettings: vi.fn(() => Promise.resolve(ok(null))),
      } as unknown as SourceRepository,
      sourceCollectorRegistry,
    );

    const result = await service.updateSourceCollectorSettings(
      "missing",
      {
        enabled: true,
        intervalMinutes: 60,
      },
      1,
    );

    assertErr(result);
    expect(result.error).toEqual({
      code: "source_not_found",
      message: "Source not found.",
    });
  });

  it("returns updated collector settings from repository", async () => {
    const source = {
      collectorSettingsVersion: 2,
      createdAt: new Date("2026-05-01T00:00:00.000Z"),
      description: null,
      id: "source-1",
      kind: "podcast",
      periodicCrawlEnabled: false,
      periodicCrawlIntervalMinutes: 30,
      recordedAt: null,
      slug: "example-feed",
      title: "Example Feed",
      url: "https://example.com/feed.xml",
      urlHash: "hash-1",
      version: 2,
    } satisfies SourceListItem;
    const service = createSourceService(
      {
        createSource: vi.fn(),
        findObserveSourceTarget: vi.fn(),
        listPeriodicCrawlTargets: vi.fn(),
        listSources: vi.fn(),
        updateSourceCollectorSettings: vi.fn(() => Promise.resolve(ok(source))),
      } as unknown as SourceRepository,
      sourceCollectorRegistry,
    );

    const result = await service.updateSourceCollectorSettings(
      "source-1",
      {
        enabled: false,
        intervalMinutes: 30,
      },
      1,
    );

    assertOk(result);
    expect(result.value).toEqual(source);
  });

  it("passes through repository errors while updating collector settings", async () => {
    const service = createSourceService(
      {
        createSource: vi.fn(),
        findObserveSourceTarget: vi.fn(),
        listPeriodicCrawlTargets: vi.fn(),
        listSources: vi.fn(),
        updateSourceCollectorSettings: vi.fn(() =>
          Promise.resolve(err(new Error("update failed"))),
        ),
      } as unknown as SourceRepository,
      sourceCollectorRegistry,
    );

    const result = await service.updateSourceCollectorSettings(
      "source-1",
      {
        enabled: true,
        intervalMinutes: 60,
      },
      1,
    );

    assertErr(result);
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error.message).toBe("update failed");
  });

  it("uses plugin source kind when creating non-podcast sources", async () => {
    const createSource = vi.fn((input: CreateSourceInput) =>
      Promise.resolve(
        ok({
          collectorSettingsVersion: 1,
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          description: input.description ?? null,
          id: "source-2",
          kind: input.kind,
          periodicCrawlEnabled: true,
          periodicCrawlIntervalMinutes: 60,
          recordedAt: null,
          slug: input.slug,
          title: input.title ?? null,
          url: input.url,
          urlHash: input.urlHash,
          version: 1,
        } satisfies SourceListItem),
      ),
    );
    const service = createSourceService(
      {
        createSource,
        findObserveSourceTarget: vi.fn(),
        listPeriodicCrawlTargets: vi.fn(),
        listSources: vi.fn(),
        updateSourceCollectorSettings: vi.fn(),
      } as unknown as SourceRepository,
      sourceCollectorRegistry,
    );

    await service.createSource({
      pluginSlug: "go-jp-rss",
      title: "Go JP",
      url: "https://example.com/blog",
    });

    expect(createSource).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "feed",
        pluginSlug: "go-jp-rss",
      }),
    );
  });
});
