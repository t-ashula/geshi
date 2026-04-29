import type { Logger } from "../logger/index.js";

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

export type SourceCollectorObserveInput = {
  abortSignal: AbortSignal;
  config: Record<string, unknown>;
  logger: Logger;
  sourceUrl: string;
};

export type SourceMetadata = {
  description: string | null;
  title: string | null;
  url: string;
};

export type SourceCollectorInspectError = {
  code:
    | "source_inspect_fetch_failed"
    | "source_inspect_unrecognized"
    | "source_inspect_unsupported";
  message: string;
};

export type SourceCollectorInspectInput = {
  abortSignal: AbortSignal;
  config: Record<string, unknown>;
  logger: Logger;
  sourceUrl: string;
};

export type SourceCollectorAcquireInput = {
  asset: ObservedAsset;
  abortSignal: AbortSignal;
  config: Record<string, unknown>;
  content: Omit<ObservedContent, "assets" | "contentFingerprints">;
  logger: Logger;
};

export type AcquiredAsset = {
  acquiredFingerprints: string[];
  body: Uint8Array;
  contentType: string | null;
  kind: string;
  metadata: Record<string, unknown>;
  primary: boolean;
  sourceUrl: string | null;
};

export interface SourceCollectorPlugin {
  inspect(input: SourceCollectorInspectInput): Promise<SourceMetadata>;
  observe(input: SourceCollectorObserveInput): Promise<ObservedContent[]>;
  acquire(input: SourceCollectorAcquireInput): Promise<AcquiredAsset>;
}
