import { describe, it, expect } from "vitest";
// import { render, screen } from '@testing-library/react';
import App from "../src/App";

describe("App", () => {
  it("should render without crashing", () => {
    // テストの実装はここに追加
    expect(App).toBe(true);
  });
});
