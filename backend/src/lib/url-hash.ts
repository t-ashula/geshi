import { sha256Hex } from "./hash.js";

export function createUrlHash(url: string): string {
  return `sha256:${sha256Hex(url)}`;
}
