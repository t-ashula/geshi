/**
 * Scribe API クライアント
 */
import axios, { AxiosInstance, isAxiosError } from "axios";
import FormData from "form-data";
import * as fs from "fs";
import * as path from "path";
import { ScribeClientConfig, defaultConfig } from "./config";
import {
  ErrorResponse,
  TranscriptResponse,
  SummaryResponse,
  TranscribeOptions,
  TranscribeRequestResult,
  TranscriptionResult,
  SummarizeOptions,
  SummarizeRequestResult,
  SummaryResult,
} from "./types";

/**
 * Scribe API クライアントクラス
 */
export class ScribeClient {
  private client: AxiosInstance;
  private config: ScribeClientConfig;

  /**
   * コンストラクタ
   * @param config クライアント設定
   */
  constructor(config: Partial<ScribeClientConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
    });
  }

  /**
   * 文字起こしリクエスト
   * @param options 文字起こしオプション
   * @returns リクエストID
   */
  async transcribe(options: TranscribeOptions): Promise<string> {
    const formData = new FormData();

    // ファイルの追加
    if (typeof options.file === "string") {
      // ファイルパスの場合
      const filename = path.basename(options.file);
      formData.append("file", fs.createReadStream(options.file), {
        filename,
        contentType: "audio/x-wav",
      });
    } else if (Buffer.isBuffer(options.file)) {
      // Bufferの場合
      formData.append("file", options.file, {
        filename: "audio.wav",
        contentType: "audio/x-wav",
      });
    } else {
      // Blobの場合
      formData.append("file", options.file, "audio.wav");
    }

    // オプションパラメータの追加
    if (options.language) {
      formData.append("language", options.language);
    }
    if (options.model) {
      formData.append("model", options.model);
    }

    try {
      const response = await this.client.post<TranscribeRequestResult>(
        "/transcribe",
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          },
        },
      );
      return response.data.request_id;
    } catch (error) {
      if (isAxiosError(error) && error.response) {
        const errorData = error.response.data as ErrorResponse;
        throw new Error(`文字起こしリクエストエラー: ${errorData.error}`);
      }
      throw error;
    }
  }

  /**
   * 文字起こし結果の取得
   * @param requestId リクエストID
   * @param waitForCompletion 完了まで待機するかどうか
   * @returns 文字起こし結果
   */
  async getTranscription(
    requestId: string,
    waitForCompletion = true,
  ): Promise<TranscriptionResult> {
    if (waitForCompletion) {
      return this.pollForTranscription(requestId);
    }

    try {
      const response = await this.client.get(`/transcribe/${requestId}`);
      const data = response.data;

      if (data.status === "done") {
        return {
          text: (data as TranscriptResponse).text,
          expires_at: new Date((data as TranscriptResponse).expires_at),
        };
      }

      throw new Error(`文字起こしはまだ完了していません: ${data.status}`);
    } catch (error) {
      if (isAxiosError(error) && error.response) {
        const errorData = error.response.data as ErrorResponse;
        throw new Error(`文字起こし結果取得エラー: ${errorData.error}`);
      }
      throw error;
    }
  }

  /**
   * 文字起こし結果をポーリングで取得
   * @param requestId リクエストID
   * @returns 文字起こし結果
   */
  private async pollForTranscription(
    requestId: string,
  ): Promise<TranscriptionResult> {
    let attempts = 0;

    while (attempts < this.config.maxPollingAttempts) {
      try {
        const response = await this.client.get(`/transcribe/${requestId}`);
        const data = response.data;

        if (data.status === "done") {
          return {
            text: (data as TranscriptResponse).text,
            expires_at: new Date((data as TranscriptResponse).expires_at),
          };
        }

        // まだ完了していない場合は待機
        await new Promise((resolve) =>
          setTimeout(resolve, this.config.pollingInterval),
        );
        attempts++;
      } catch (error) {
        if (isAxiosError(error) && error.response) {
          const errorData = error.response.data as ErrorResponse;
          throw new Error(`文字起こし結果取得エラー: ${errorData.error}`);
        }
        throw error;
      }
    }

    throw new Error("文字起こし結果の取得がタイムアウトしました");
  }

  /**
   * 要約リクエスト
   * @param options 要約オプション
   * @returns リクエストID
   */
  async summarize(options: SummarizeOptions): Promise<string> {
    try {
      const response = await this.client.post<SummarizeRequestResult>(
        "/summarize",
        {
          text: options.text,
          strength: options.strength,
        },
      );
      return response.data.request_id;
    } catch (error) {
      if (isAxiosError(error) && error.response) {
        const errorData = error.response.data as ErrorResponse;
        throw new Error(`要約リクエストエラー: ${errorData.error}`);
      }
      throw error;
    }
  }

  /**
   * 要約結果の取得
   * @param requestId リクエストID
   * @param waitForCompletion 完了まで待機するかどうか
   * @returns 要約結果
   */
  async getSummary(
    requestId: string,
    waitForCompletion = true,
  ): Promise<SummaryResult> {
    if (waitForCompletion) {
      return this.pollForSummary(requestId);
    }

    try {
      const response = await this.client.get(`/summarize/${requestId}`);
      const data = response.data;

      if (data.status === "done") {
        return {
          summary: (data as SummaryResponse).summary,
          expires_at: new Date((data as SummaryResponse).expires_at),
        };
      }

      throw new Error(`要約はまだ完了していません: ${data.status}`);
    } catch (error) {
      if (isAxiosError(error) && error.response) {
        const errorData = error.response.data as ErrorResponse;
        throw new Error(`要約結果取得エラー: ${errorData.error}`);
      }
      throw error;
    }
  }

  /**
   * 要約結果をポーリングで取得
   * @param requestId リクエストID
   * @returns 要約結果
   */
  private async pollForSummary(requestId: string): Promise<SummaryResult> {
    let attempts = 0;

    while (attempts < this.config.maxPollingAttempts) {
      try {
        const response = await this.client.get(`/summarize/${requestId}`);
        const data = response.data;

        if (data.status === "done") {
          return {
            summary: (data as SummaryResponse).summary,
            expires_at: new Date((data as SummaryResponse).expires_at),
          };
        }

        // まだ完了していない場合は待機
        await new Promise((resolve) =>
          setTimeout(resolve, this.config.pollingInterval),
        );
        attempts++;
      } catch (error) {
        if (isAxiosError(error) && error.response) {
          const errorData = error.response.data as ErrorResponse;
          throw new Error(`要約結果取得エラー: ${errorData.error}`);
        }
        throw error;
      }
    }

    throw new Error("要約結果の取得がタイムアウトしました");
  }
}
