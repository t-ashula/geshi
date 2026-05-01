import { describe, expect, it, vi } from "vitest";

const inspectMock = vi.fn();

vi.mock("../../src/plugins/index.js", () => ({
  getSourceCollectorPlugin: vi.fn(() => ({
    inspect: inspectMock,
  })),
}));

import { createSourceInspectService } from "../../src/service/source-inspect-service.js";
import { assertOk } from "../support/result.js";

describe("source inspect service", () => {
  it("rejects invalid source urls before hitting the plugin", async () => {
    const service = createSourceInspectService();

    await expect(
      service.inspectSource({
        url: "not-a-url",
      }),
    ).resolves.toEqual({
      error: {
        code: "source_url_invalid",
        message: "RSS URL must be an absolute http or https URL.",
      },
      ok: false,
    });
    expect(inspectMock).not.toHaveBeenCalled();
  });

  it("returns normalized metadata and derived slug", async () => {
    inspectMock.mockResolvedValueOnce({
      description: "Weekly notes",
      title: "Example Feed",
      url: "https://example.com/shows/example-feed",
    });
    const service = createSourceInspectService();

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
    const service = createSourceInspectService();

    await expect(
      service.inspectSource({
        url: "https://example.com/feed.xml",
      }),
    ).resolves.toEqual({
      error: {
        code: "source_inspect_fetch_failed",
        message: "upstream failed",
      },
      ok: false,
    });
  });

  it("rethrows unknown plugin failures", async () => {
    inspectMock.mockRejectedValueOnce(new Error("boom"));
    const service = createSourceInspectService();

    await expect(
      service.inspectSource({
        url: "https://example.com/feed.xml",
      }),
    ).rejects.toThrow("boom");
  });
});
