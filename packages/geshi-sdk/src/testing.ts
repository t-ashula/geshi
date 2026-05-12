import type {
  AcquiredAsset,
  ObservedAsset,
  ObservedContent,
  RecordedAsset,
  SourceCollectorObserveResult,
} from "./index.js";

type FingerprintValidationOptions = {
  /**
   * Temporary migration escape hatch.
   * Use only while a plugin emits both versioned and legacy fingerprints.
   */
  allowLegacyFingerprintsDuringMigration?: boolean;
};

const VERSIONED_FINGERPRINT_PREFIX_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const VERSIONED_FINGERPRINT_BODY_PATTERN = /^[0-9a-f]{64}$/;

export function assertSourceCollectorObserveResultContract(
  result: SourceCollectorObserveResult,
  options: FingerprintValidationOptions = {},
): void {
  for (const content of result.contents) {
    assertObservedContentContract(content, options);
  }
}

export function assertAcquiredAssetContract(
  asset: AcquiredAsset,
  options: FingerprintValidationOptions = {},
): void {
  assertFingerprintList(
    asset.acquiredFingerprints,
    "acquiredFingerprints",
    options,
  );
}

export function assertRecordedAssetContract(
  asset: RecordedAsset,
  options: FingerprintValidationOptions = {},
): void {
  assertFingerprintList(
    asset.acquiredFingerprints,
    "acquiredFingerprints",
    options,
  );
}

function assertObservedContentContract(
  content: ObservedContent,
  options: FingerprintValidationOptions,
): void {
  assertFingerprintList(
    content.contentFingerprints,
    "contentFingerprints",
    options,
  );

  for (const asset of content.assets) {
    assertObservedAssetContract(asset, options);
  }
}

function assertObservedAssetContract(
  asset: ObservedAsset,
  options: FingerprintValidationOptions,
): void {
  if (asset.nextAction === undefined) {
    throw new Error("ObservedAsset.nextAction is required.");
  }

  assertFingerprintList(
    asset.observedFingerprints,
    "observedFingerprints",
    options,
  );
}

function assertFingerprintList(
  fingerprints: string[],
  label: string,
  options: FingerprintValidationOptions,
): void {
  if (fingerprints.length === 0) {
    throw new Error(`${label} must not be empty.`);
  }

  let versionedFingerprintCount = 0;

  for (const fingerprint of fingerprints) {
    if (assertFingerprintFormat(fingerprint, options) === "versioned") {
      versionedFingerprintCount += 1;
    }
  }

  if (versionedFingerprintCount === 0) {
    throw new Error(
      `${label} must include at least one versioned fingerprint.`,
    );
  }
}

function assertFingerprintFormat(
  fingerprint: string,
  options: FingerprintValidationOptions,
): "legacy" | "versioned" {
  const allowLegacyFingerprintsDuringMigration =
    options.allowLegacyFingerprintsDuringMigration === true;
  const separatorIndex = fingerprint.indexOf(":");

  if (separatorIndex <= 0) {
    throw new Error(`Fingerprint must contain a prefix: ${fingerprint}`);
  }

  const prefix = fingerprint.slice(0, separatorIndex);
  const body = fingerprint.slice(separatorIndex + 1);

  if (body.length === 0) {
    throw new Error(`Fingerprint body is required: ${fingerprint}`);
  }

  if (!VERSIONED_FINGERPRINT_PREFIX_PATTERN.test(prefix)) {
    if (allowLegacyFingerprintsDuringMigration) {
      return "legacy";
    }

    throw new Error(
      `Fingerprint prefix must use yyyy-mm-dd versioning: ${fingerprint}`,
    );
  }

  if (!VERSIONED_FINGERPRINT_BODY_PATTERN.test(body)) {
    throw new Error(
      `Versioned fingerprint body must be a 64-char lowercase hex hash: ${fingerprint}`,
    );
  }

  return "versioned";
}
