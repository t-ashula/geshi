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
  get(key: string): Promise<Uint8Array>;
  pathJoin(...parts: string[]): string;
  put(input: StoragePutInput): Promise<StoragePutOutput>;
}
