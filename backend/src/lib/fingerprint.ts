export function findLatestFingerprint(
  fingerprints: string[],
): string | undefined {
  return [...fingerprints].sort(compareFingerprintVersions)[0];
}

export function compareFingerprintVersions(
  left: string,
  right: string,
): number {
  const leftVersion = readFingerprintVersion(left);
  const rightVersion = readFingerprintVersion(right);

  if (leftVersion === rightVersion) {
    return 0;
  }

  return leftVersion < rightVersion ? 1 : -1;
}

export function readFingerprintVersion(fingerprint: string): string {
  const separatorIndex = fingerprint.indexOf(":");

  if (separatorIndex === -1) {
    throw new Error(`Invalid fingerprint format: ${fingerprint}`);
  }

  return fingerprint.slice(0, separatorIndex);
}
