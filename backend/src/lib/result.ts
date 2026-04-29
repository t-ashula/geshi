export type Result<T, E> = { ok: true; value: T } | { error: E; ok: false };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { error, ok: false };
}
