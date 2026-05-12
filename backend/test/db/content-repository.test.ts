import { describe, expect, it } from "vitest";

import { mergeObservedContentStatus } from "../../src/db/content-repository.js";

describe("content repository status merge", () => {
  it("keeps stored status when observe reports discovered again", () => {
    expect(mergeObservedContentStatus("stored", "discovered")).toBe("stored");
  });

  it("keeps failed status when observe reports discovered again", () => {
    expect(mergeObservedContentStatus("failed", "discovered")).toBe("failed");
  });

  it("keeps discovered status when observe reports discovered", () => {
    expect(mergeObservedContentStatus("discovered", "discovered")).toBe(
      "discovered",
    );
  });

  it("accepts non-discovered observed statuses as explicit updates", () => {
    expect(mergeObservedContentStatus("discovered", "stored")).toBe("stored");
    expect(mergeObservedContentStatus("stored", "failed")).toBe("failed");
  });
});
