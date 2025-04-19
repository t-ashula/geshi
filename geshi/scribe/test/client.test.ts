import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
// import axios from "axios";
import type { AxiosStatic } from "axios";
import { ScribeClient } from "../src/client";

const mockedAxiosInstance = {
  get: vi.fn(),
  post: vi.fn(),
};
vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<AxiosStatic>();
  return {
    ...actual,
    // FIXME:
    isAxiosError: () => true,
    default: {
      create: () => mockedAxiosInstance,
    },
  };
});

describe("ScribeClient", () => {
  let client: ScribeClient;

  beforeEach(() => {
    // テスト前にモックをリセット
    vi.resetAllMocks();

    // テスト用のクライアントを作成
    client = new ScribeClient({
      baseUrl: "http://test-api.example.com",
      timeout: 5000,
      pollingInterval: 100,
      maxPollingAttempts: 3,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("transcribe", () => {
    it("文字起こしリクエストを送信できること", async () => {
      // モックレスポンスの設定
      mockedAxiosInstance.post.mockResolvedValueOnce({
        data: { request_id: "test-request-id" },
      });

      // テスト実行
      const requestId = await client.transcribe({
        file: "test-audio-file.wav", // ファイルパスを使用
        language: "ja",
        model: "base",
      });

      // 検証
      expect(requestId).toBe("test-request-id");
      expect(mockedAxiosInstance.post).toHaveBeenCalledTimes(1);
      expect(mockedAxiosInstance.post).toHaveBeenCalledWith(
        "/transcribe",
        expect.any(Object),
        expect.objectContaining({
          headers: expect.any(Object),
        }),
      );
    });

    it("エラーレスポンスを適切に処理できること", async () => {
      // エラーレスポンスのモック
      const errorResponse = {
        response: {
          data: { error: "テストエラー" },
        },
      };
      // TODO: axios.post は AxiosError 型でエラーレスポンスを throw してくるはずなのでこれは正しくない
      mockedAxiosInstance.post.mockRejectedValueOnce(errorResponse);

      // テスト実行とエラー検証
      await expect(
        client.transcribe({
          file: "test-audio-file.wav", // ファイルパスを使用
        }),
      ).rejects.toThrow("文字起こしリクエストエラー: テストエラー");
    });
  });

  describe("getTranscription", () => {
    it("文字起こし結果を取得できること", async () => {
      // モックレスポンスの設定
      mockedAxiosInstance.get.mockResolvedValueOnce({
        data: {
          status: "done",
          text: "テスト文字起こし結果",
          expires_at: "2025-05-01T00:00:00Z",
        },
      });

      // テスト実行
      const result = await client.getTranscription("test-request-id", false);

      // 検証
      expect(result).toEqual({
        text: "テスト文字起こし結果",
        expires_at: expect.any(Date),
      });
      expect(mockedAxiosInstance.get).toHaveBeenCalledTimes(1);
      expect(mockedAxiosInstance.get).toHaveBeenCalledWith(
        "/transcribe/test-request-id",
      );
    });

    it("ポーリングで文字起こし結果を取得できること", async () => {
      // 進行中のレスポンス
      mockedAxiosInstance.get.mockResolvedValueOnce({
        data: { status: "working" },
      });

      // 完了レスポンス
      mockedAxiosInstance.get.mockResolvedValueOnce({
        data: {
          status: "done",
          text: "テスト文字起こし結果",
          expires_at: "2025-05-01T00:00:00Z",
        },
      });

      // テスト実行
      const result = await client.getTranscription("test-request-id", true);

      // 検証
      expect(result).toEqual({
        text: "テスト文字起こし結果",
        expires_at: expect.any(Date),
      });
      expect(mockedAxiosInstance.get).toHaveBeenCalledTimes(2);
    });
  });

  describe("summarize", () => {
    it("要約リクエストを送信できること", async () => {
      // モックレスポンスの設定
      mockedAxiosInstance.post.mockResolvedValueOnce({
        data: { request_id: "test-summary-id" },
      });

      // テスト実行
      const requestId = await client.summarize({
        text: "テスト対象テキスト",
        strength: 3,
      });

      // 検証
      expect(requestId).toBe("test-summary-id");
      expect(mockedAxiosInstance.post).toHaveBeenCalledTimes(1);
      expect(mockedAxiosInstance.post).toHaveBeenCalledWith("/summarize", {
        text: "テスト対象テキスト",
        strength: 3,
      });
    });
  });

  describe("getSummary", () => {
    it("要約結果を取得できること", async () => {
      // モックレスポンスの設定
      mockedAxiosInstance.get.mockResolvedValueOnce({
        data: {
          status: "done",
          summary: "テスト要約結果",
          expires_at: "2025-05-01T00:00:00Z",
        },
      });

      // テスト実行
      const result = await client.getSummary("test-summary-id", false);

      // 検証
      expect(result).toEqual({
        summary: "テスト要約結果",
        expires_at: expect.any(Date),
      });
      expect(mockedAxiosInstance.get).toHaveBeenCalledTimes(1);
      expect(mockedAxiosInstance.get).toHaveBeenCalledWith(
        "/summarize/test-summary-id",
      );
    });
  });
});
