export type ObservedContent = {
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
  abortSignal: AbortSignal;
  config: Record<string, unknown>;
  externalId: string | null;
  logger: Logger;
  sourceUrl: string | null;
  workDir: string;
};

export type AcquiredAsset = {
  contentType: string | null;
  fileName: string;
  filePath: string;
  kind: string;
  metadata: Record<string, unknown>;
};

export interface SourceCollectorPlugin {
  observe(input: SourceCollectorObserveInput): Promise<ObservedContent[]>;
  acquire(input: SourceCollectorAcquireInput): Promise<AcquiredAsset[]>;
}
