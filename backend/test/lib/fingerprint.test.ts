import { describe, expect, it } from "vitest";

import {
  compareFingerprintVersions,
  findLatestFingerprint,
  readFingerprintVersion,
} from "../../src/lib/fingerprint.js";

describe("fingerprint version helpers", () => {
  it("reads the prefix before the first separator", () => {
    expect(readFingerprintVersion("2026-05-10:abcdef")).toBe("2026-05-10");
    expect(readFingerprintVersion("radiko-content:station:start:end")).toBe(
      "radiko-content",
    );
  });

  it("treats legacy prefixes as older than versioned fingerprints", () => {
    expect(
      compareFingerprintVersions(
        "2026-05-10:0123456789abcdef",
        "radiko-content:QRR:2026-05-10T01:00:00.000Z",
      ),
    ).toBeLessThan(0);
  });

  it("keeps versioned fingerprints ordered by descending prefix", () => {
    expect(
      compareFingerprintVersions("2026-05-10:bbbb", "2026-05-09:aaaa"),
    ).toBeLessThan(0);
  });

  it("selects a versioned fingerprint over legacy compatibility values", () => {
    expect(
      findLatestFingerprint([
        "radiko-content:QRR:2026-05-10T01:00:00.000Z",
        "2026-05-10:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      ]),
    ).toBe(
      "2026-05-10:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    );
  });

  it("throws when no separator exists", () => {
    expect(() => readFingerprintVersion("invalid")).toThrow(
      "Invalid fingerprint format: invalid",
    );
  });
});
