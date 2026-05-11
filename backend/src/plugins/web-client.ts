import { chromium } from "playwright";

import type {
  GetWebClientInput,
  PluginLogger,
  PluginWebClient,
} from "./types.js";

export function getWebClient(
  input: GetWebClientInput,
  logger: PluginLogger,
): Promise<PluginWebClient> {
  logger.debug("plugin webClient resolved.", {
    kind: input.kind,
  });

  return Promise.resolve(
    input.kind === "browser"
      ? {
          fetch: (request) => fetchWithBrowser(request, logger),
          getBrowser: () =>
            chromium.launch({
              headless: true,
            }),
        }
      : {
          fetch: (request) => fetch(request),
        },
  );
}

export async function fetchWithBrowser(
  request: Request,
  logger: PluginLogger,
): Promise<Response> {
  const method = request.method.toUpperCase();

  logger.info("browser webClient request started.", {
    method,
    url: request.url,
  });

  if (method !== "GET") {
    throw new Error(`Browser webClient only supports GET requests: ${method}`);
  }

  if (request.signal.aborted) {
    throw createAbortError();
  }

  const browser = await chromium.launch({
    headless: true,
  });
  const headerEntries = [...request.headers.entries()];
  const extraHTTPHeaders = Object.fromEntries(
    headerEntries.filter(([name]) => name.toLowerCase() !== "user-agent"),
  );
  const userAgent = request.headers.get("user-agent") ?? undefined;
  const browserContext = await browser.newContext({
    extraHTTPHeaders,
    userAgent,
  });
  const page = await browserContext.newPage();
  const abortHandler = () => {
    void browser.close().catch((error: unknown) => {
      logger.warn("browser webClient cleanup failed after abort.", {
        error: error instanceof Error ? error.message : String(error),
        url: request.url,
      });
    });
  };

  request.signal.addEventListener("abort", abortHandler, {
    once: true,
  });

  try {
    await page.route("**/*", async (route) => {
      const resourceType = route.request().resourceType();

      if (
        resourceType === "font" ||
        resourceType === "image" ||
        resourceType === "media"
      ) {
        await route.abort();
        return;
      }

      await route.continue();
    });

    const navigationResponse = await page.goto(request.url, {
      waitUntil: "load",
    });

    if (request.signal.aborted) {
      throw createAbortError();
    }

    const html = await page.content();
    const headers = new Headers(navigationResponse?.headers() ?? {});

    if (!headers.has("content-type")) {
      headers.set("content-type", "text/html; charset=utf-8");
    }

    logger.info("browser webClient request completed.", {
      contentType: headers.get("content-type"),
      status: navigationResponse?.status() ?? 200,
      url: request.url,
    });

    return new Response(html, {
      headers,
      status: navigationResponse?.status() ?? 200,
      statusText: navigationResponse?.statusText() ?? "OK",
    });
  } catch (error) {
    if (request.signal.aborted) {
      logger.warn("browser webClient request aborted.", {
        method,
        url: request.url,
      });
      throw createAbortError();
    }

    logger.warn("browser webClient request failed.", {
      error: error instanceof Error ? error.message : String(error),
      method,
      url: request.url,
    });
    throw error;
  } finally {
    request.signal.removeEventListener("abort", abortHandler);

    try {
      await browser.close();
    } catch (error) {
      logger.warn("browser webClient cleanup failed.", {
        error: error instanceof Error ? error.message : String(error),
        url: request.url,
      });
    }
  }
}

function createAbortError(): Error {
  const error = new Error("The operation was aborted.");
  error.name = "AbortError";

  return error;
}
