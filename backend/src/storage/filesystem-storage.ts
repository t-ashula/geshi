import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

import { err, ok } from "../lib/result.js";
import type { Storage, StoragePutInput } from "./types.js";

export class FilesystemStorage implements Storage {
  public constructor(private readonly rootDir: string) {}

  public async get(key: string) {
    try {
      return ok(new Uint8Array(await readFile(this.resolveStoragePath(key))));
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to read storage object."),
      );
    }
  }

  public pathJoin(...parts: string[]): string {
    const key = join(...parts);

    this.resolveStoragePath(key);

    return key;
  }

  public async put(input: StoragePutInput) {
    try {
      const filePath = this.resolveStoragePath(input.key);

      await mkdir(dirname(filePath), {
        recursive: true,
      });

      const body = input.body;
      const exists = await fileExists(filePath);

      if (exists && !input.overwrite) {
        return err(new Error(`Storage key already exists: ${input.key}`));
      }

      await writeFile(filePath, body);

      return ok({
        byteSize: body.byteLength,
        contentType: input.contentType,
        key: input.key,
      });
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to write storage object."),
      );
    }
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
