import { expect } from "vitest";

import type { Err, Ok, Result } from "../../src/lib/result.js";

export function assertOk<T, E>(result: Result<T, E>): asserts result is Ok<T> {
  expect(result.ok).toBe(true);
}

export function assertErr<T, E>(
  result: Result<T, E>,
): asserts result is Err<E> {
  expect(result.ok).toBe(false);
}
