import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import axios from "axios";
import { Readable } from "stream";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const TEST_DOWNLOAD_DIR = "/test/downloads";
const TEST_UUID = "test-uuid-123";
const TEST_FILE_PATH = path.join(TEST_DOWNLOAD_DIR, TEST_UUID);
const TEST_URL = "https://geshi.test/test.mp3";

vi.mock("axios");
vi.mock("uuid");
vi.mock("fs");

vi.mock("../src/logger", () => ({
  default: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("util", () => {
  return {
    promisify: vi.fn(() => {
      return vi.fn().mockResolvedValue({ size: 1024 });
    }),
  };
});

describe("download function", () => {
  let mockWriteStream;
  let mockStream;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    process.env.DOWNLOAD_DIR = TEST_DOWNLOAD_DIR;
    
    vi.mocked(uuidv4).mockReturnValue(TEST_UUID as ReturnType<typeof uuidv4>);
    
    mockWriteStream = {
      on: vi.fn().mockImplementation(function(event, callback) {
        if (event === 'finish') {
          setTimeout(() => callback(), 10);
        }
        return this;
      }),
      write: vi.fn(),
      end: vi.fn(),
    };
    
    mockStream = new Readable();
    mockStream.push("test data");
    mockStream.push(null);
    mockStream.pipe = vi.fn().mockReturnValue(mockWriteStream);
    
    vi.mocked(fs.existsSync).mockImplementation((path) => {
      if (String(path) === TEST_DOWNLOAD_DIR) {
        return true; // Default behavior, will be overridden in tests
      }
      return false;
    });
    
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
    vi.mocked(fs.createWriteStream).mockReturnValue(mockWriteStream as fs.WriteStream);
    vi.mocked(fs.unlink).mockImplementation((path, callback) => {
      if (callback) callback(null);
      return undefined;
    });
    vi.mocked(fs.unlinkSync).mockImplementation(() => undefined);
    
    vi.mocked(axios).mockResolvedValue({
      data: mockStream,
    });
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.DOWNLOAD_DIR;
  });
  
  it("should successfully download a file when directory exists", async () => {
    vi.mocked(fs.existsSync).mockReturnValueOnce(true);
    
    const { download } = await import("../src/funcs/download");
    
    const result = await download(TEST_URL);
    
    expect(result).toMatchObject({
      success: true,
      size: 1024,
      outputPath: TEST_FILE_PATH,
    });
    expect(fs.existsSync).toHaveBeenCalledWith(TEST_DOWNLOAD_DIR);
    expect(fs.mkdirSync).not.toHaveBeenCalled();
    expect(axios).toHaveBeenCalledWith({
      method: "GET",
      url: TEST_URL,
      responseType: "stream",
      headers: {
        "User-Agent": "Geshi-Crawler/1.0",
      },
      timeout: 30000,
    });
  });
  
  it("should create download directory when it doesn't exist", async () => {
    vi.mocked(fs.existsSync).mockReturnValueOnce(false);
    
    const { download } = await import("../src/funcs/download");
    
    const result = await download(TEST_URL);
    
    expect(result).toMatchObject({
      success: true,
      size: 1024,
      outputPath: TEST_FILE_PATH,
    });
    expect(fs.existsSync).toHaveBeenCalledWith(TEST_DOWNLOAD_DIR);
    expect(fs.mkdirSync).toHaveBeenCalledWith(TEST_DOWNLOAD_DIR, { recursive: true });
  });
  
  it("should handle network errors gracefully", async () => {
    const networkError = new Error("Network error");
    vi.mocked(axios).mockRejectedValueOnce(networkError);
    
    const { download } = await import("../src/funcs/download");
    
    await expect(download(TEST_URL)).rejects.toThrow("Network error");
  });
});
