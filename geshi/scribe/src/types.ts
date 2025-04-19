/**
 * Scribe API 共通型定義
 */

// エラーレスポンス
export interface ErrorResponse {
  error: string;
}

// ステータスレスポンス
export interface StatusResponse {
  status: "pending" | "working";
}

// 文字起こしレスポンス
export interface TranscriptResponse {
  status: "done";
  text: string;
  expires_at: string;
}

// 要約レスポンス
export interface SummaryResponse {
  status: "done";
  summary: string;
  expires_at: string;
}

// 文字起こしオプション
export interface TranscribeOptions {
  file: string | Buffer | Blob;
  language?: string;
  model?: string;
}

// 文字起こしリクエスト結果
export interface TranscribeRequestResult {
  request_id: string;
}

// 文字起こし結果
export interface TranscriptionResult {
  text: string;
  expires_at: Date;
}

// 要約オプション
export interface SummarizeOptions {
  text: string;
  strength: number;
}

// 要約リクエスト結果
export interface SummarizeRequestResult {
  request_id: string;
}

// 要約結果
export interface SummaryResult {
  summary: string;
  expires_at: Date;
}
