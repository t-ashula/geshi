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

export type PluginLogMetadata = Record<string, unknown>;

export interface PluginLogger {
  debug(message: string, metadata?: PluginLogMetadata): void;
  info(message: string, metadata?: PluginLogMetadata): void;
  warn(message: string, metadata?: PluginLogMetadata): void;
  error(message: string, metadata?: PluginLogMetadata): void;
}

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
  context?: SourceCollectorExecutionContext;
  logger: PluginLogger;
  sourceUrl: string;
};

export type SourceCollectorSupportsInput = {
  config: Record<string, unknown>;
  context?: SourceCollectorExecutionContext;
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
  context?: SourceCollectorExecutionContext;
  logger: PluginLogger;
  sourceUrl: string;
};

export type SourceCollectorExecutionContext = {
  getWebClient?(): Promise<PluginWebClient>;
  putWorkObject?(input: {
    body: Uint8Array;
    overwrite: boolean;
  }): Promise<{ byteSize: number; key: string }>;
  replacePluginMetadata?(metadata: JsonObject): Promise<void>;
};

export interface PluginWebClient {
  fetch(request: Request): Promise<Response>;
  getBrowser?(): Promise<unknown>;
}

export function createPluginWebClient(input: {
  fetch(request: Request): Promise<Response>;
  getBrowser?(): Promise<unknown>;
}): PluginWebClient {
  let getBrowser: (() => Promise<unknown>) | undefined;

  if (input.getBrowser !== undefined) {
    getBrowser = (): Promise<unknown> => input.getBrowser!();
  }

  return {
    fetch: (request) => input.fetch(request),
    getBrowser,
  };
}

export type SourceCollectorAcquireInput = {
  asset: ObservedAsset;
  abortSignal: AbortSignal;
  collectorPluginState?: JsonObject;
  config: Record<string, unknown>;
  content: Omit<ObservedContent, "assets" | "contentFingerprints">;
  context?: SourceCollectorExecutionContext;
  logger: PluginLogger;
};

export type SourceCollectorRecordInput = {
  arguments: JsonObject;
  asset: ObservedAsset;
  abortSignal: AbortSignal;
  collectorPluginState?: JsonObject;
  config: Record<string, unknown>;
  content: Omit<ObservedContent, "assets" | "contentFingerprints">;
  context: SourceCollectorExecutionContext;
  logger: PluginLogger;
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
  ): Promise<SourceCollectorSupportsResult>;
  settingSchema?():
    | SourceCollectorSettingSchemaField[]
    | Promise<SourceCollectorSettingSchemaField[]>;
  inspect(input: SourceCollectorInspectInput): Promise<SourceMetadata>;
  observe(
    input: SourceCollectorObserveInput,
  ): Promise<SourceCollectorObserveResult>;
  acquire(input: SourceCollectorAcquireInput): Promise<AcquiredAsset>;
  record?(input: SourceCollectorRecordInput): Promise<RecordedAsset>;
}

export type SourceCollectorPluginDefinition = {
  manifest: PluginManifest;
  plugin: SourceCollectorPlugin;
};

export {
  assertAcquiredAssetContract,
  assertRecordedAssetContract,
  assertSourceCollectorObserveResultContract,
} from "./testing.js";
