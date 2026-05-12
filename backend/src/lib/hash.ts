import { createHash } from "node:crypto";

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function sha256BytesHex(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function sha256ChecksumString(value: Uint8Array): string {
  return `sha256:${sha256BytesHex(value)}`;
}
