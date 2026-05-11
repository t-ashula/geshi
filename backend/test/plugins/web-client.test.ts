import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  closeMock,
  contentMock,
  gotoMock,
  launchMock,
  newContextMock,
  newPageMock,
  routeMock,
} = vi.hoisted(() => {
  const closeMock = vi.fn(() => Promise.resolve());
  const gotoMock = vi.fn();
  const contentMock = vi.fn();
  const routeMock = vi.fn(() => Promise.resolve());
  const newPageMock = vi.fn(() =>
    Promise.resolve({
      content: contentMock,
      goto: gotoMock,
      route: routeMock,
    }),
  );
  const newContextMock = vi.fn(() =>
    Promise.resolve({
      newPage: newPageMock,
    }),
  );
  const launchMock = vi.fn(() =>
    Promise.resolve({
      close: closeMock,
      newContext: newContextMock,
    }),
  );

  return {
    closeMock,
    contentMock,
    gotoMock,
    launchMock,
    newContextMock,
    newPageMock,
    routeMock,
  };
});

vi.mock("playwright", () => ({
  chromium: {
    launch: launchMock,
  },
}));

import {
  fetchWithBrowser,
  getWebClient,
} from "../../src/plugins/web-client.js";

function createNoopPluginLogger() {
  return {
    debug() {},
    error() {},
    info() {},
    warn() {},
  };
}

describe("fetchWithBrowser", () => {
  beforeEach(() => {
    closeMock.mockClear();
    contentMock.mockClear();
    gotoMock.mockClear();
    launchMock.mockClear();
    newContextMock.mockClear();
    newPageMock.mockClear();
    routeMock.mockClear();
  });

  it("returns a browser-backed response", async () => {
    gotoMock.mockResolvedValueOnce({
      headers: () => ({
        "content-type": "text/html; charset=utf-8",
      }),
      status: () => 200,
      statusText: () => "OK",
    });
    contentMock.mockResolvedValueOnce(
      "<html><body><main><p>Rendered</p></main></body></html>",
    );
    const response = await fetchWithBrowser(
      new Request("https://example.com/article", {
        headers: {
          "user-agent": "example-agent",
          "x-example": "value",
        },
        method: "GET",
      }),
      createNoopPluginLogger(),
    );

    expect(launchMock).toHaveBeenCalledWith({
      headless: true,
    });
    expect(newContextMock).toHaveBeenCalledWith({
      extraHTTPHeaders: {
        "x-example": "value",
      },
      userAgent: "example-agent",
    });
    expect(routeMock).toHaveBeenCalledWith("**/*", expect.any(Function));
    expect(gotoMock).toHaveBeenCalledWith("https://example.com/article", {
      waitUntil: "load",
    });
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe(
      "<html><body><main><p>Rendered</p></main></body></html>",
    );
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it("rejects non-GET requests", async () => {
    await expect(
      fetchWithBrowser(
        new Request("https://example.com/article", {
          method: "POST",
        }),
        createNoopPluginLogger(),
      ),
    ).rejects.toThrow("Browser webClient only supports GET requests: POST");
  });

  it("returns a fetch-backed client", async () => {
    const webClient = await getWebClient(
      { kind: "fetch" },
      createNoopPluginLogger(),
    );

    expect(typeof webClient.fetch).toBe("function");
    expect("getBrowser" in webClient).toBe(false);
  });

  it("returns a browser-backed client with browser escape hatch", async () => {
    const webClient = await getWebClient(
      { kind: "browser" },
      createNoopPluginLogger(),
    );

    expect(typeof webClient.fetch).toBe("function");
    expect(typeof webClient.getBrowser).toBe("function");

    if (webClient.getBrowser === undefined) {
      throw new Error("browser webClient must expose getBrowser()");
    }

    const browserUnknown: unknown = await webClient.getBrowser();

    expect(browserUnknown).toBeDefined();
    expect(typeof browserUnknown).toBe("object");

    if (typeof browserUnknown !== "object" || browserUnknown === null) {
      throw new Error("browser escape hatch must return an object");
    }

    expect("close" in browserUnknown).toBe(true);
    expect("newContext" in browserUnknown).toBe(true);
  });
});
