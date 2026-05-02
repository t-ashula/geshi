import { describe, expect, it, vi } from "vitest";

import { createSourceInspectService } from "../../src/service/source-inspect-service.js";
import { assertErr, assertOk } from "../support/result.js";

const inspectMock = vi.fn();
const createRegistryPlugin = () => ({
  acquire: vi.fn(),
  inspect: inspectMock,
  observe: vi.fn(),
  supports: vi.fn(),
});

describe("source inspect service", () => {
  it("rejects invalid source urls before hitting the plugin", async () => {
    const service = createSourceInspectService({
      sourceCollectorRegistry: {
        get: vi.fn(() => ({
          ...createRegistryPlugin(),
        })),
        getSourceKind: vi.fn(() => "podcast" as const),
      },
    });

    const result = await service.inspectSource({
      url: "not-a-url",
    });
    expect(result.ok).toBe(false);
    assertErr(result);
    expect(result.error).toEqual({
      code: "source_url_invalid",
      message: "Source URL must be an absolute http or https URL.",
    });
    expect(inspectMock).not.toHaveBeenCalled();
  });

  it("returns normalized metadata and derived slug", async () => {
    inspectMock.mockResolvedValueOnce({
      description: "Weekly notes",
      title: "Example Feed",
      url: "https://example.com/shows/example-feed",
    });
    const service = createSourceInspectService({
      sourceCollectorRegistry: {
        get: vi.fn(() => ({
          ...createRegistryPlugin(),
        })),
        getSourceKind: vi.fn(() => "podcast" as const),
      },
    });

    const result = await service.inspectSource({
      url: " https://example.com/feed.xml ",
    });

    expect(inspectMock).toHaveBeenCalledWith(
      expect.objectContaining({
        config: {},
        sourceUrl: "https://example.com/feed.xml",
      }),
    );
    assertOk(result);
    expect(result.value).toMatchObject({
      description: "Weekly notes",
      title: "Example Feed",
      url: "https://example.com/shows/example-feed",
    });
    expect(result.value.sourceSlug).toMatch(/^example-feed/);
  });

  it("returns inspect errors as results", async () => {
    inspectMock.mockRejectedValueOnce({
      code: "source_inspect_fetch_failed",
      message: "upstream failed",
    });
    const service = createSourceInspectService({
      sourceCollectorRegistry: {
        get: vi.fn(() => ({
          ...createRegistryPlugin(),
        })),
        getSourceKind: vi.fn(() => "podcast" as const),
      },
    });

    const result = await service.inspectSource({
      url: "https://example.com/feed.xml",
    });
    expect(result.ok).toBe(false);
    assertErr(result);
    expect(result.error).toEqual({
      code: "source_inspect_fetch_failed",
      message: "upstream failed",
    });
  });

  it("returns unknown plugin failures as results", async () => {
    inspectMock.mockRejectedValueOnce(new Error("boom"));
    const service = createSourceInspectService({
      sourceCollectorRegistry: {
        get: vi.fn(() => ({
          ...createRegistryPlugin(),
        })),
        getSourceKind: vi.fn(() => "podcast" as const),
      },
    });

    const result = await service.inspectSource({
      url: "https://example.com/feed.xml",
    });

    assertErr(result);
    expect(result.error).toEqual({
      code: "source_inspect_failed",
      message: "boom",
    });
  });
});
