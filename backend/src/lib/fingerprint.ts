export function findLatestFingerprint(
  fingerprints: string[],
): string | undefined {
  return [...fingerprints].sort(compareFingerprintVersions)[0];
}

export function compareFingerprintVersions(
  left: string,
  right: string,
): number {
  const leftVersion = parseFingerprintVersion(left);
  const rightVersion = parseFingerprintVersion(right);

  if (leftVersion.kind !== rightVersion.kind) {
    return leftVersion.kind === "versioned" ? -1 : 1;
  }

  if (leftVersion.version === rightVersion.version) {
    return 0;
  }

  return leftVersion.version < rightVersion.version ? 1 : -1;
}

export function readFingerprintVersion(fingerprint: string): string {
  const separatorIndex = fingerprint.indexOf(":");

  if (separatorIndex === -1) {
    throw new Error(`Invalid fingerprint format: ${fingerprint}`);
  }

  return fingerprint.slice(0, separatorIndex);
}

function parseFingerprintVersion(fingerprint: string): {
  kind: "legacy" | "versioned";
  version: string;
} {
  const version = readFingerprintVersion(fingerprint);

  return {
    kind: /^\d{4}-\d{2}-\d{2}$/.test(version) ? "versioned" : "legacy",
    version,
  };
}
