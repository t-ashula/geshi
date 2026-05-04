import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { FilesystemStorage } from "../../src/storage/filesystem-storage.js";

describe("FilesystemStorage", () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), "geshi-storage-test-"));
  });

  it("stores and retrieves an object", async () => {
    const storage = new FilesystemStorage(rootDir);
    const stored = await storage.put({
      body: new Uint8Array(Buffer.from("hello")),
      contentType: "text/html",
      key: "source/content/page-hash.html",
      overwrite: false,
    });
    if (!stored.ok) {
      throw stored.error;
    }

    expect(stored.value.key).toBe("source/content/page-hash.html");
    await expect(storage.get(stored.value.key)).resolves.toMatchObject({
      ok: true,
      value: new Uint8Array(Buffer.from("hello")),
    });
  });

  it("overwrites an existing object when overwrite is true", async () => {
    const storage = new FilesystemStorage(rootDir);
    const first = await storage.put({
      body: new Uint8Array(Buffer.from("first")),
      contentType: "audio/mpeg",
      key: "source/content/audio-hash.mp3",
      overwrite: false,
    });
    const second = await storage.put({
      body: new Uint8Array(Buffer.from("second")),
      contentType: "audio/mpeg",
      key: "source/content/audio-hash.mp3",
      overwrite: true,
    });

    if (!first.ok) {
      throw first.error;
    }
    if (!second.ok) {
      throw second.error;
    }

    expect(second.value.key).toBe(first.value.key);
    await expect(storage.get(first.value.key)).resolves.toMatchObject({
      ok: true,
      value: new Uint8Array(Buffer.from("second")),
    });
  });

  it("deletes an existing object", async () => {
    const storage = new FilesystemStorage(rootDir);
    const stored = await storage.put({
      body: new Uint8Array(Buffer.from("hello")),
      contentType: "text/plain",
      key: "work/transcripts/chunk-1.wav",
      overwrite: false,
    });

    if (!stored.ok) {
      throw stored.error;
    }

    await expect(storage.delete(stored.value.key)).resolves.toMatchObject({
      ok: true,
    });
    await expect(storage.get(stored.value.key)).resolves.toMatchObject({
      ok: false,
    });
  });

  it("joins path parts", () => {
    const storage = new FilesystemStorage(rootDir);

    expect(storage.pathJoin("source", "content", "file.ext")).toBe(
      join("source", "content", "file.ext"),
    );
  });

  it("rejects keys that escape rootDir", async () => {
    const storage = new FilesystemStorage(rootDir);

    expect(() => storage.pathJoin("..", "evil.txt")).toThrow();
    await expect(
      storage.put({
        body: new Uint8Array(Buffer.from("evil")),
        contentType: "text/html",
        key: "../evil.txt",
        overwrite: false,
      }),
    ).resolves.toMatchObject({ ok: false });
  });

  it("does not confuse sibling paths with rootDir descendants", async () => {
    const storage = new FilesystemStorage(rootDir);
    const siblingLikeKey = resolve(`${rootDir}-sibling`, "evil.txt");

    await expect(
      storage.put({
        body: new Uint8Array(Buffer.from("evil")),
        contentType: "text/html",
        key: siblingLikeKey,
        overwrite: false,
      }),
    ).resolves.toMatchObject({ ok: false });
  });
});
