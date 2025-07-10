import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import axios from "axios";
import { Readable } from "stream";
import { download } from "../src/funcs/download";

vi.mock("axios");
vi.mock("../src/logger", () => ({
  default: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const mockedAxios = vi.mocked(axios);

class MockReadableStream extends Readable {
  private data: string;
  private sent: boolean = false;

  constructor(data: string) {
    super();
    this.data = data;
  }

  _read() {
    if (!this.sent) {
      this.push(this.data);
      this.push(null);
      this.sent = true;
    }
  }
}

describe("download function", () => {
  const testDownloadDir = path.join(process.cwd(), "test-downloads");
  const originalDownloadDir = process.env.DOWNLOAD_DIR;
  
  beforeEach(() => {
    process.env.DOWNLOAD_DIR = testDownloadDir;
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await new Promise(resolve => setTimeout(resolve, 50));
    
    if (fs.existsSync(testDownloadDir)) {
      fs.rmSync(testDownloadDir, { recursive: true, force: true });
    }
    if (originalDownloadDir) {
      process.env.DOWNLOAD_DIR = originalDownloadDir;
    } else {
      delete process.env.DOWNLOAD_DIR;
    }
  });

  it("should successfully download a file when directory exists", async () => {
    const testUrl = "https://example.com/test.mp3";
    const mockData = "test file content";
    const mockStream = new MockReadableStream(mockData);

    fs.mkdirSync(testDownloadDir, { recursive: true });

    mockedAxios.mockResolvedValue({
      data: mockStream,
    });

    const result = await download(testUrl);

    expect(result.success).toBe(true);
    expect(result.size).toBeGreaterThan(0);
    expect(result.outputPath).toContain(testDownloadDir);
    expect(fs.existsSync(result.outputPath)).toBe(true);
    
    expect(mockedAxios).toHaveBeenCalledWith({
      method: "GET",
      url: testUrl,
      responseType: "stream",
      headers: {
        "User-Agent": "Geshi-Crawler/1.0",
      },
      timeout: 30000,
    });
  });

  it("should create download directory when it doesn't exist", async () => {
    const testUrl = "https://example.com/test.mp3";
    const mockData = "test file content";
    const mockStream = new MockReadableStream(mockData);

    expect(fs.existsSync(testDownloadDir)).toBe(false);

    mockedAxios.mockResolvedValue({
      data: mockStream,
    });

    const result = await download(testUrl);

    expect(result.success).toBe(true);
    expect(fs.existsSync(testDownloadDir)).toBe(true);
    expect(fs.existsSync(result.outputPath)).toBe(true);
  });

  it("should handle network errors gracefully", async () => {
    const testUrl = "https://example.com/test.mp3";
    const networkError = new Error("Network error");

    mockedAxios.mockRejectedValue(networkError);

    await expect(download(testUrl)).rejects.toThrow("Network error");
  });

});
