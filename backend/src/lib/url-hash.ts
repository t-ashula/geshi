import { createHash } from "node:crypto";

export function createUrlHash(url: string): string {
  const hash = createHash("sha256").update(url).digest("hex");

  return `sha256:${hash}`;
}
