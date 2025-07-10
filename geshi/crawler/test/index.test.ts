import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should successfully download a file when directory exists", async () => {
    const testUrl = "https://geshi.test/test.mp3";
    const mockData = "test file content";
    const mockStream = new MockReadableStream(mockData);

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    
    const mockWriter = {
      on: vi.fn((event, callback) => {
        if (event === 'finish') {
          setTimeout(() => callback(), 10);
        }
        return mockWriter;
      }),
      write: vi.fn(),
      end: vi.fn(),
    };
    
    vi.spyOn(fs, 'createWriteStream').mockReturnValue(mockWriter as any);
    vi.spyOn(fs, 'stat').mockImplementation((path, callback) => {
      (callback as any)(null, { size: mockData.length });
    });

    mockStream.pipe = vi.fn((dest) => {
      setTimeout(() => {
        const finishCallback = mockWriter.on.mock.calls.find(call => call[0] === 'finish')?.[1];
        if (finishCallback) finishCallback();
      }, 10);
      return dest;
    });

    mockedAxios.mockResolvedValue({
      data: mockStream,
    });

    const result = await download(testUrl);

    expect(result.success).toBe(true);
    expect(result.size).toBe(mockData.length);
    expect(fs.existsSync).toHaveBeenCalled();
    
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
    const testUrl = "https://geshi.test/test.mp3";
    const mockData = "test file content";
    const mockStream = new MockReadableStream(mockData);

    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    const mkdirSyncSpy = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
    
    const mockWriter = {
      on: vi.fn((event, callback) => {
        if (event === 'finish') {
          setTimeout(() => callback(), 10);
        }
        return mockWriter;
      }),
      write: vi.fn(),
      end: vi.fn(),
    };
    
    vi.spyOn(fs, 'createWriteStream').mockReturnValue(mockWriter as any);
    vi.spyOn(fs, 'stat').mockImplementation((path, callback) => {
      (callback as any)(null, { size: mockData.length });
    });

    mockStream.pipe = vi.fn((dest) => {
      setTimeout(() => {
        const finishCallback = mockWriter.on.mock.calls.find(call => call[0] === 'finish')?.[1];
        if (finishCallback) finishCallback();
      }, 10);
      return dest;
    });

    mockedAxios.mockResolvedValue({
      data: mockStream,
    });

    const result = await download(testUrl);

    expect(result.success).toBe(true);
    expect(fs.existsSync).toHaveBeenCalled();
    expect(mkdirSyncSpy).toHaveBeenCalledWith(expect.any(String), { recursive: true });
  });

  it("should handle network errors gracefully", async () => {
    const testUrl = "https://geshi.test/test.mp3";
    const networkError = new Error("Network error");

    mockedAxios.mockRejectedValue(networkError);

    await expect(download(testUrl)).rejects.toThrow("Network error");
  });

});
