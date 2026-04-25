import { describe, expect, it } from "vitest";

import { createAppName } from "../src/index.js";

describe("createAppName", () => {
  it("prefixes the app name", () => {
    expect(createAppName("crawler")).toBe("geshi:crawler");
  });
});
