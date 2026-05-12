import { describe, expect, it } from "vitest";

import {
  assertAcquiredAssetContract,
  assertRecordedAssetContract,
  assertSourceCollectorObserveResultContract,
} from "../src/index.js";

describe("sdk testing helpers", () => {
  it("accepts versioned observe results", () => {
    expect(() =>
      assertSourceCollectorObserveResultContract({
        contents: [
          {
            assets: [
              {
                kind: "audio",
                nextAction: {
                  actionKind: "record",
                  arguments: {
                    stationId: "QRR",
                  },
                },
                observedFingerprints: [
                  "2026-05-10:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
                ],
                primary: true,
                sourceUrl: "https://example.com/audio",
              },
            ],
            contentFingerprints: [
              "2026-05-10:abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
            ],
            externalId: "content-1",
            kind: "stream-recording",
            publishedAt: null,
            status: "discovered",
            summary: null,
            title: "Title",
          },
        ],
      }),
    ).not.toThrow();
  });

  it("rejects legacy fingerprints by default", () => {
    expect(() =>
      assertSourceCollectorObserveResultContract({
        contents: [
          {
            assets: [
              {
                kind: "audio",
                nextAction: {
                  actionKind: "acquire",
                },
                observedFingerprints: ["radiko-observed-audio:legacy-value"],
                primary: true,
                sourceUrl: "https://example.com/audio",
              },
            ],
            contentFingerprints: ["radiko-content:legacy-value"],
            externalId: "content-1",
            kind: "stream-recording",
            publishedAt: null,
            status: "discovered",
            summary: null,
            title: "Title",
          },
        ],
      }),
    ).toThrow("Fingerprint prefix must use yyyy-mm-dd versioning");
  });

  it("accepts legacy fingerprints in compatibility mode when versioned values are also present", () => {
    expect(() =>
      assertSourceCollectorObserveResultContract(
        {
          contents: [
            {
              assets: [
                {
                  kind: "audio",
                  nextAction: {
                    actionKind: "none",
                    reason: "already-ended",
                  },
                  observedFingerprints: [
                    "2026-05-10:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
                    "radiko-observed-audio:legacy-value",
                  ],
                  primary: true,
                  sourceUrl: "https://example.com/audio",
                },
              ],
              contentFingerprints: [
                "2026-05-10:abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
                "radiko-content:legacy-value",
              ],
              externalId: "content-1",
              kind: "stream-recording",
              publishedAt: null,
              status: "discovered",
              summary: null,
              title: "Title",
            },
          ],
        },
        {
          allowLegacyFingerprintsDuringMigration: true,
        },
      ),
    ).not.toThrow();
  });

  it("rejects legacy-only fingerprints even in compatibility mode", () => {
    expect(() =>
      assertRecordedAssetContract(
        {
          acquiredFingerprints: ["radiko-recorded-audio:legacy-value"],
          body: new Uint8Array([1]),
          contentType: "audio/mp4",
          kind: "audio",
          metadata: {},
          primary: true,
          sourceUrl: "https://example.com/audio",
        },
        {
          allowLegacyFingerprintsDuringMigration: true,
        },
      ),
    ).toThrow(
      "acquiredFingerprints must include at least one versioned fingerprint.",
    );
  });

  it("validates acquired and recorded asset fingerprints", () => {
    expect(() =>
      assertAcquiredAssetContract({
        acquiredFingerprints: [
          "2026-05-10:abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
        ],
        body: new Uint8Array([1]),
        contentType: "audio/mpeg",
        kind: "audio",
        metadata: {},
        primary: true,
        sourceUrl: "https://example.com/audio",
      }),
    ).not.toThrow();

    expect(() =>
      assertRecordedAssetContract(
        {
          acquiredFingerprints: [
            "2026-05-10:abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
            "radiko-recorded-audio:legacy-value",
          ],
          body: new Uint8Array([1]),
          contentType: "audio/mp4",
          kind: "audio",
          metadata: {},
          primary: true,
          sourceUrl: "https://example.com/audio",
        },
        {
          allowLegacyFingerprintsDuringMigration: true,
        },
      ),
    ).not.toThrow();
  });
});
