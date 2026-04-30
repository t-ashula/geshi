import type { Result } from "../lib/result.js";

export type StoragePutInput = {
  body: Uint8Array;
  contentType: string | null;
  key: string;
  overwrite: boolean;
};

export type StoragePutOutput = {
  byteSize: number;
  contentType: string | null;
  key: string;
};

export interface Storage {
  get(key: string): Promise<Result<Uint8Array, Error>>;
  pathJoin(...parts: string[]): string;
  put(input: StoragePutInput): Promise<Result<StoragePutOutput, Error>>;
}
