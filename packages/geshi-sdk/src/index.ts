export type JsonPrimitive = boolean | null | number | string;

export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export type JsonObject = {
  [key: string]: JsonValue;
};

export type SourceCollectorSettingFieldType = {
  type: "text";
};

export type SourceCollectorSettingSchemaField = {
  key: string;
  type: SourceCollectorSettingFieldType;
};

export type SourceCollectorSettingValue = JsonValue | null;

export type ExtractorAsset = {
  body: Uint8Array;
  kind: string;
  mimeType: string | null;
  sourceUrl: string | null;
};

export type ExtractedDetailBody = {
  body: string;
  format: "html" | "markdown" | "plain";
};

export type PluginLogMetadata = Record<string, unknown>;

export interface PluginLogger {
  debug(message: string, metadata?: PluginLogMetadata): void;
  info(message: string, metadata?: PluginLogMetadata): void;
  warn(message: string, metadata?: PluginLogMetadata): void;
  error(message: string, metadata?: PluginLogMetadata): void;
}

export type SourceCollectorHost = {
  logger: PluginLogger;
  putWorkObject?(input: {
    body: Uint8Array;
    overwrite: boolean;
  }): Promise<{ byteSize: number; key: string }>;
  replacePluginMetadata?(metadata: JsonObject): Promise<void>;
};

export type SourceCollectorSourceKind = "feed" | "podcast" | "streaming";

export type SourceCollectorPluginCapability = {
  kind: "source-collector";
  sourceKind: SourceCollectorSourceKind;
};

export type PluginCapability = SourceCollectorPluginCapability;

export type PluginManifest = {
  apiVersion: "1";
  capabilities: PluginCapability[];
  description?: string;
  displayName: string;
  pluginSlug: string;
};

export type SourceCollectorNextActionKind = "acquire" | "none" | "record";

export type SourceCollectorNonActionableReason =
  | "already-ended"
  | "missed-recording-window"
  | "outside-retention-window"
  | "requires-manual-action"
  | "unsupported";

export type SourceCollectorExpirationAction =
  | "mark_failed"
  | "mark_non_actionable";

export type SourceCollectorExpirationPolicy = {
  action: SourceCollectorExpirationAction;
  message?: string;
  reason: SourceCollectorNonActionableReason;
};

type SourceCollectorScheduledNextAction = {
  actionKind: "acquire" | "record";
  arguments?: JsonObject;
  expirationPolicy?: SourceCollectorExpirationPolicy;
  latestRunnableAt?: Date | null;
  scheduledStartAt?: Date | null;
};

type SourceCollectorNoneNextAction = {
  actionKind: "none";
  message?: string;
  reason: SourceCollectorNonActionableReason;
};

export type SourceCollectorNextAction =
  | SourceCollectorScheduledNextAction
  | SourceCollectorNoneNextAction;

export type ObservedAsset = {
  kind: string;
  nextAction: SourceCollectorNextAction;
  observedFingerprints: string[];
  primary: boolean;
  sourceUrl: string | null;
};

export type ObservedContent = {
  assets: ObservedAsset[];
  contentFingerprints: string[];
  externalId: string;
  kind: string;
  publishedAt: Date | null;
  status: "discovered" | "stored" | "failed";
  summary: string | null;
  title: string | null;
};

export type SourceCollectorObserveResult = {
  collectorPluginState?: JsonObject;
  contents: ObservedContent[];
};

export type SourceCollectorObserveInput = {
  abortSignal: AbortSignal;
  collectorPluginState?: JsonObject;
  config: Record<string, unknown>;
  sourceUrl: string;
};

export type SourceCollectorSupportsInput = {
  config: Record<string, unknown>;
  sourceUrl: string;
};

export type SourceCollectorSupportsResult = {
  supported: boolean;
};

export type SourceMetadata = {
  description: string | null;
  title: string | null;
  url: string;
};

export type SourceCollectorInspectErrorCode =
  | "source_inspect_fetch_failed"
  | "source_inspect_unrecognized"
  | "source_inspect_unsupported";

export type SourceCollectorInspectError = {
  code: SourceCollectorInspectErrorCode;
  message: string;
};

export type SourceCollectorInspectInput = {
  abortSignal: AbortSignal;
  config: Record<string, unknown>;
  sourceUrl: string;
};

export type SourceCollectorExecutionContext = {
  getHost(): SourceCollectorHost;
};

export type GetWebClientInput = {
  kind: "browser" | "fetch";
};

export interface PluginWebClient {
  fetch(request: Request): Promise<Response>;
  getBrowser?(): Promise<unknown>;
}

export type SourceCollectorAcquireInput = {
  asset: ObservedAsset;
  abortSignal: AbortSignal;
  collectorPluginState?: JsonObject;
  config: Record<string, unknown>;
  content: Omit<ObservedContent, "assets" | "contentFingerprints">;
};

export type SourceCollectorExtractInput = {
  asset: ExtractorAsset;
};

export type SourceCollectorRecordInput = {
  arguments: JsonObject;
  asset: ObservedAsset;
  abortSignal: AbortSignal;
  collectorPluginState?: JsonObject;
  config: Record<string, unknown>;
  content: Omit<ObservedContent, "assets" | "contentFingerprints">;
};

type AssetBodyPayload = {
  body: Uint8Array;
  workStorageKey?: never;
};

type AssetWorkStoragePayload = {
  body?: never;
  workStorageKey: string;
};

type AssetArtifactPayload = AssetBodyPayload | AssetWorkStoragePayload;

export type AcquiredAsset = {
  acquiredFingerprints: string[];
  contentType: string | null;
  kind: string;
  metadata: JsonObject;
  primary: boolean;
  sourceUrl: string | null;
} & AssetArtifactPayload;

export type RecordedAsset = {
  acquiredFingerprints: string[];
  contentType: string | null;
  kind: string;
  metadata: JsonObject;
  primary: boolean;
  sourceUrl: string | null;
} & AssetArtifactPayload;

export interface SourceCollectorPlugin {
  supports(
    input: SourceCollectorSupportsInput,
    context: SourceCollectorExecutionContext,
  ): Promise<SourceCollectorSupportsResult>;
  settingSchema():
    | SourceCollectorSettingSchemaField[]
    | Promise<SourceCollectorSettingSchemaField[]>;
  inspect(
    input: SourceCollectorInspectInput,
    context: SourceCollectorExecutionContext,
  ): Promise<SourceMetadata>;
  observe(
    input: SourceCollectorObserveInput,
    context: SourceCollectorExecutionContext,
  ): Promise<SourceCollectorObserveResult>;
  extract(
    input: SourceCollectorExtractInput,
    context: SourceCollectorExecutionContext,
  ): Promise<ExtractedDetailBody | null>;
  acquire(
    input: SourceCollectorAcquireInput,
    context: SourceCollectorExecutionContext,
  ): Promise<AcquiredAsset>;
  record?(
    input: SourceCollectorRecordInput,
    context: SourceCollectorExecutionContext,
  ): Promise<RecordedAsset>;
}

export type SourceCollectorPluginDefinition = {
  manifest: PluginManifest;
  plugin: SourceCollectorPlugin;
};

async function getChromium() {
  const playwrightModule = (await import("playwright")) as {
    chromium: {
      launch(input: { headless: boolean }): Promise<unknown>;
    };
  };

  return playwrightModule.chromium;
}

async function fetchWithBrowser(request: Request): Promise<Response> {
  const method = request.method.toUpperCase();

  if (method !== "GET") {
    throw new Error(`Browser webClient only supports GET requests: ${method}`);
  }

  if (request.signal.aborted) {
    throw createAbortError();
  }

  const chromium = await getChromium();
  const browser = await chromium.launch({
    headless: true,
  });
  const headerEntries = [...request.headers.entries()];
  const extraHTTPHeaders = Object.fromEntries(
    headerEntries.filter(([name]) => name.toLowerCase() !== "user-agent"),
  );
  const userAgent = request.headers.get("user-agent") ?? undefined;
  const browserContext = await (
    browser as {
      newContext(input: {
        extraHTTPHeaders: Record<string, string>;
        userAgent?: string;
      }): Promise<{
        close(): Promise<void>;
        newPage(): Promise<{
          content(): Promise<string>;
          goto(
            url: string,
            input: { waitUntil: "load" },
          ): Promise<{
            headers(): Record<string, string>;
            status(): number;
            statusText(): string;
          } | null>;
          off(event: "response", listener: (...args: unknown[]) => void): void;
          on(event: "response", listener: (...args: unknown[]) => void): void;
          route(
            pattern: string,
            handler: (route: {
              abort(): Promise<void>;
              continue(): Promise<void>;
              request(): {
                resourceType(): string;
              };
            }) => Promise<void>,
          ): Promise<void>;
        }>;
      }>;
    }
  ).newContext({
    extraHTTPHeaders,
    userAgent,
  });
  const page = await browserContext.newPage();
  const abortHandler = () => {
    void (browser as { close(): Promise<void> }).close().catch(() => {});
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

    return new Response(html, {
      headers,
      status: navigationResponse?.status() ?? 200,
      statusText: navigationResponse?.statusText() ?? "OK",
    });
  } finally {
    request.signal.removeEventListener("abort", abortHandler);
    if (
      "close" in browserContext &&
      typeof browserContext.close === "function"
    ) {
      await browserContext.close();
    }
    await (browser as { close(): Promise<void> }).close();
  }
}

function createAbortError(): Error {
  const error = new Error("The operation was aborted.");
  error.name = "AbortError";

  return error;
}

export const WebClient = {
  create(input: GetWebClientInput): PluginWebClient {
    if (input.kind === "browser") {
      return {
        fetch(request: Request): Promise<Response> {
          return fetchWithBrowser(request);
        },
        async getBrowser(): Promise<unknown> {
          const chromium = await getChromium();
          return chromium.launch({
            headless: true,
          });
        },
      };
    }

    return {
      fetch(request: Request): Promise<Response> {
        return fetch(request);
      },
    };
  },
};

export {
  assertAcquiredAssetContract,
  assertRecordedAssetContract,
  assertSourceCollectorObserveResultContract,
} from "./testing.js";
