export type JsonPrimitive = boolean | null | number | string;

export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export type JsonObject = {
  [key: string]: JsonValue;
};

export type PluginLogMetadata = Record<string, unknown>;

export interface PluginLogger {
  debug(message: string, metadata?: PluginLogMetadata): void;
  info(message: string, metadata?: PluginLogMetadata): void;
  warn(message: string, metadata?: PluginLogMetadata): void;
  error(message: string, metadata?: PluginLogMetadata): void;
}

export type SourceCollectorSourceKind = "feed" | "podcast";

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

export type ObservedAsset = {
  kind: string;
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
  logger: PluginLogger;
  sourceUrl: string;
};

export type SourceCollectorSupportsInput = {
  config: Record<string, unknown>;
  logger: PluginLogger;
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
  logger: PluginLogger;
  sourceUrl: string;
};

export type SourceCollectorAcquireInput = {
  asset: ObservedAsset;
  abortSignal: AbortSignal;
  collectorPluginState?: JsonObject;
  config: Record<string, unknown>;
  content: Omit<ObservedContent, "assets" | "contentFingerprints">;
  logger: PluginLogger;
};

export type AcquiredAsset = {
  acquiredFingerprints: string[];
  body: Uint8Array;
  contentType: string | null;
  kind: string;
  metadata: JsonObject;
  primary: boolean;
  sourceUrl: string | null;
};

export interface SourceCollectorPlugin {
  supports(
    input: SourceCollectorSupportsInput,
  ): Promise<SourceCollectorSupportsResult>;
  inspect(input: SourceCollectorInspectInput): Promise<SourceMetadata>;
  observe(
    input: SourceCollectorObserveInput,
  ): Promise<SourceCollectorObserveResult>;
  acquire(input: SourceCollectorAcquireInput): Promise<AcquiredAsset>;
}

export type SourceCollectorPluginDefinition = {
  manifest: PluginManifest;
  plugin: SourceCollectorPlugin;
};
