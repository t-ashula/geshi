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

export type Logger = {
  error(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
};

export type SourceCollectorObserveInput = {
  abortSignal: AbortSignal;
  config: Record<string, unknown>;
  logger: Logger;
  sourceUrl: string;
  workDir: string;
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
  observe(input: SourceCollectorObserveInput): Promise<ObservedContent[]>;
  acquire(input: SourceCollectorAcquireInput): Promise<AcquiredAsset>;
}
