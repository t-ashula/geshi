import { sha256BytesHex, sha256Hex } from "../../../lib/hash.js";

export type ObservedContent_V2026_04_28 = {
  assets: ObservedAsset_V2026_04_28[];
  contentFingerprints: string[];
  externalId: string;
  kind: string;
  publishedAt: Date | null;
  status: "discovered" | "stored" | "failed";
  summary: string | null;
  title: string | null;
};

export type ObservedAsset_V2026_04_28 = {
  kind: string;
  observedFingerprints: string[];
  primary: boolean;
  sourceUrl: string | null;
};

export type AcquiredAsset_V2026_04_28 = {
  acquiredFingerprints: string[];
  body: Uint8Array;
  contentType: string | null;
  kind: string;
  metadata: Record<string, unknown>;
  primary: boolean;
  sourceUrl: string | null;
};

export type ObservedContentFingerprintInputV2026_04_28 = Omit<
  ObservedContent_V2026_04_28,
  "assets" | "contentFingerprints"
>;

export type ObservedAssetFingerprintInputV2026_04_28 = Omit<
  ObservedAsset_V2026_04_28,
  "observedFingerprints"
>;

export type AcquiredAssetFingerprintInputV2026_04_28 = Omit<
  AcquiredAsset_V2026_04_28,
  "acquiredFingerprints"
>;

export type ObservedContentFingerprintInput =
  ObservedContentFingerprintInputV2026_04_28;

export type ObservedAssetFingerprintInput =
  ObservedAssetFingerprintInputV2026_04_28;

export type AcquiredAssetFingerprintInput =
  AcquiredAssetFingerprintInputV2026_04_28;

export type ContentFingerprintSpec<TInput> = {
  create: (input: TInput) => string;
  version: string;
};

export type ObservedAssetFingerprintSpec<TInput> = {
  create: (asset: TInput) => string;
  version: string;
};

export type AcquiredAssetFingerprintSpec<TInput> = {
  create: (asset: TInput) => string;
  version: string;
};

export const CONTENT_FINGERPRINT_SPECS: ContentFingerprintSpec<ObservedContentFingerprintInput>[] =
  [
    {
      version: "2026-04-28",
      create: (input: ObservedContentFingerprintInputV2026_04_28) =>
        sha256Hex(
          [
            `externalId=${contentField(input.externalId)}`,
            `kind=${contentField(input.kind)}`,
            `status=${contentField(input.status)}`,
            `title=${contentField(input.title)}`,
            `summary=${contentField(input.summary)}`,
            `publishedAt=${dateField(input.publishedAt)}`,
          ].join("|"),
        ),
    },
  ];

export const OBSERVED_ASSET_FINGERPRINT_SPECS: ObservedAssetFingerprintSpec<ObservedAssetFingerprintInput>[] =
  [
    {
      version: "2026-04-28",
      create: (asset: ObservedAssetFingerprintInputV2026_04_28) =>
        sha256Hex(
          [
            `kind=${observedAssetField(asset.kind)}`,
            `primary=${asset.primary ? "true" : "false"}`,
            `sourceUrl=${observedAssetField(asset.sourceUrl)}`,
          ].join("|"),
        ),
    },
  ];

export const ACQUIRED_ASSET_FINGERPRINT_SPECS: AcquiredAssetFingerprintSpec<AcquiredAssetFingerprintInput>[] =
  [
    {
      version: "2026-04-28",
      create: (asset: AcquiredAssetFingerprintInputV2026_04_28) =>
        sha256Hex([`body=${sha256BytesHex(asset.body)}`].join("|")),
    },
  ];

function contentField(value: string | null | undefined): string {
  return value?.trim() ? encodeURIComponent(value.trim()) : "";
}

function dateField(value: Date | null): string {
  return value === null ? "" : encodeURIComponent(value.toISOString());
}

function observedAssetField(value: string | null): string {
  return value === null ? "" : encodeURIComponent(value);
}
