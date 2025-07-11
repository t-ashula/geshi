import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { recordHLS } from "../src/funcs/record";

vi.mock("fs", () => ({
  default: {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    statSync: vi.fn(),
    createWriteStream: vi.fn(),
  },
}));

vi.mock("child_process", () => ({
  spawn: vi.fn(),
}));

vi.mock("uuid", () => ({
  v4: vi.fn(() => "test-uuid"),
}));

describe("Crawler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("recordHLS", () => {
    it("should create directory when it does not exist", async () => {
      const mockExistsSync = vi.mocked(fs.existsSync);
      const mockMkdirSync = vi.mocked(fs.mkdirSync);
      
      mockExistsSync.mockReturnValue(false);
      
      const { spawn } = await import("child_process");
      const mockSpawn = vi.mocked(spawn);
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === "close") {
            setTimeout(() => callback(0), 0);
          }
        }),
        kill: vi.fn(),
      };
      mockSpawn.mockReturnValue(mockProcess as unknown as ReturnType<typeof spawn>);
      
      const mockStatSync = vi.mocked(fs.statSync);
      mockStatSync.mockReturnValue({ size: 1024 } as ReturnType<typeof fs.statSync>);

      const promise = recordHLS("http://example.com/stream.m3u8", { duration: 10 });
      
      await promise;

      const expectedDir = path.dirname(path.join(process.env.DOWNLOAD_DIR || path.join(process.cwd(), "records"), "test-uuid"));
      expect(mockExistsSync).toHaveBeenCalledWith(expectedDir);
      expect(mockMkdirSync).toHaveBeenCalledWith(expectedDir, { recursive: true });
    });

    it("should not create directory when it already exists", async () => {
      const mockExistsSync = vi.mocked(fs.existsSync);
      const mockMkdirSync = vi.mocked(fs.mkdirSync);
      
      mockExistsSync.mockReturnValue(true);
      
      const { spawn } = await import("child_process");
      const mockSpawn = vi.mocked(spawn);
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === "close") {
            setTimeout(() => callback(0), 0);
          }
        }),
        kill: vi.fn(),
      };
      mockSpawn.mockReturnValue(mockProcess as unknown as ReturnType<typeof spawn>);
      
      const mockStatSync = vi.mocked(fs.statSync);
      mockStatSync.mockReturnValue({ size: 1024 } as ReturnType<typeof fs.statSync>);

      const promise = recordHLS("http://example.com/stream.m3u8", { duration: 10 });
      await promise;

      const expectedDir = path.dirname(path.join(process.env.DOWNLOAD_DIR || path.join(process.cwd(), "records"), "test-uuid"));
      expect(mockExistsSync).toHaveBeenCalledWith(expectedDir);
      expect(mockMkdirSync).not.toHaveBeenCalled();
    });
  });
});
