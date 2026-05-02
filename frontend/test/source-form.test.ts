import { describe, expect, it } from "vitest";

import { validateCreateSourceRequest } from "../src/source-form.js";

describe("validateCreateSourceRequest", () => {
  it("requires a url", () => {
    expect(
      validateCreateSourceRequest({
        description: "",
        sourceSlug: "",
        title: "",
        url: "   ",
      }),
    ).toBe("Source URL is required.");
  });

  it("rejects non-http urls", () => {
    expect(
      validateCreateSourceRequest({
        description: "",
        sourceSlug: "",
        title: "",
        url: "ftp://example.com/feed.xml",
      }),
    ).toBe("Source URL must be an absolute http or https URL.");
  });

  it("accepts valid http urls", () => {
    expect(
      validateCreateSourceRequest({
        description: "",
        sourceSlug: "",
        title: "",
        url: "https://example.com/feed.xml",
      }),
    ).toBeNull();
  });
});
