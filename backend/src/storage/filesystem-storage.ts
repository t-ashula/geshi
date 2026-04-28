import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

import type { Storage, StoragePutInput, StoragePutOutput } from "./types.js";

export class FilesystemStorage implements Storage {
  public constructor(private readonly rootDir: string) {}

  public async get(key: string): Promise<Uint8Array> {
    return new Uint8Array(await readFile(this.resolveStoragePath(key)));
  }

  public pathJoin(...parts: string[]): string {
    const key = join(...parts);

    this.resolveStoragePath(key);

    return key;
  }

  public async put(input: StoragePutInput): Promise<StoragePutOutput> {
    const filePath = this.resolveStoragePath(input.key);

    await mkdir(dirname(filePath), {
      recursive: true,
    });

    const body = input.body;
    const exists = await fileExists(filePath);

    if (exists && !input.overwrite) {
      throw new Error(`Storage key already exists: ${input.key}`);
    }

    await writeFile(filePath, body);

    return {
      byteSize: body.byteLength,
      contentType: input.contentType,
      key: input.key,
    };
  }

  private resolveStoragePath(key: string): string {
    const resolvedRootDir = resolve(this.rootDir);
    const resolvedPath = resolve(resolvedRootDir, key);

    if (
      resolvedPath !== resolvedRootDir &&
      !resolvedPath.startsWith(`${resolvedRootDir}${sep}`)
    ) {
      throw new Error(`Invalid storage key found.: ${key}`);
    }

    return resolvedPath;
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
