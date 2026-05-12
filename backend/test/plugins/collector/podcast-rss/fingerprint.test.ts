import { describe, expect, it } from "vitest";

import {
  ACQUIRED_ASSET_FINGERPRINT_SPECS,
  CONTENT_FINGERPRINT_SPECS,
  OBSERVED_ASSET_FINGERPRINT_SPECS,
} from "../../../../src/plugins/collector/podcast-rss/fingerprint.js";

describe("podcast RSS fingerprint specs", () => {
  it("freezes content fingerprint output for 2026-04-28", () => {
    const contentSpec = CONTENT_FINGERPRINT_SPECS.find(
      (spec) => spec.version === "2026-04-28",
    );

    expect(contentSpec).toBeDefined();

    const fingerprint = `${contentSpec!.version}:${contentSpec!.create({
      externalId: "ep-1",
      kind: "podcast-episode",
      publishedAt: new Date("2024-01-01T00:00:00.000Z"),
      status: "discovered",
      summary: "Hello",
      title: "Episode 1",
    })}`;

    expect(fingerprint).toBe(
      "2026-04-28:b6aff8a084129f73c1749f653608f20639c12b068dccd5309c2294feb0c5f782",
    );
  });

  it("freezes observed asset fingerprint output for 2026-04-28", () => {
    const observedAssetSpec = OBSERVED_ASSET_FINGERPRINT_SPECS.find(
      (spec) => spec.version === "2026-04-28",
    );

    expect(observedAssetSpec).toBeDefined();

    const htmlFingerprint = `${observedAssetSpec!.version}:${observedAssetSpec!.create(
      {
        kind: "html",
        primary: true,
        sourceUrl: "https://example.com/episodes/1",
      },
    )}`;
    const audioFingerprint = `${observedAssetSpec!.version}:${observedAssetSpec!.create(
      {
        kind: "audio",
        primary: false,
        sourceUrl: "https://cdn.example.com/audio/1.mp3",
      },
    )}`;

    expect(htmlFingerprint).toBe(
      "2026-04-28:c75804f84f56f8232a6318f56b81538f670718f56445a5a6d829c254110b4c7e",
    );
    expect(audioFingerprint).toBe(
      "2026-04-28:395ce08d54017eac5cc597b6df0e66c3c22c55870cc18dff645657da16980bf7",
    );
  });

  it("freezes acquired asset fingerprint output for 2026-04-28", () => {
    const acquiredAssetSpec = ACQUIRED_ASSET_FINGERPRINT_SPECS.find(
      (spec) => spec.version === "2026-04-28",
    );

    expect(acquiredAssetSpec).toBeDefined();

    const htmlFingerprint = `${acquiredAssetSpec!.version}:${acquiredAssetSpec!.create(
      {
        body: new TextEncoder().encode("<html>Episode 1</html>"),
        contentType: "text/htmlああああああああああ",
        kind: "html",
        metadata: {},
        primary: true,
        sourceUrl: "https://example.com/episodes/1",
      },
    )}`;
    const audioFingerprint = `${acquiredAssetSpec!.version}:${acquiredAssetSpec!.create(
      {
        body: new Uint8Array([1, 2, 3]),
        contentType: "audio/mpeg",
        kind: "audio",
        metadata: {},
        primary: false,
        sourceUrl: "https://cdn.example.com/audio/1.mp3",
      },
    )}`;

    expect(htmlFingerprint).toBe(
      "2026-04-28:a71edb10274fbb3e9e279ff5ec23d0ba43a7d848bb5f8cc9cdf4e9b1a6397e11",
    );
    expect(audioFingerprint).toBe(
      "2026-04-28:edee03df9ae663d7fe79a4ae112615d321a4130468102c0e4fe0c4719e4f4908",
    );
  });
});
