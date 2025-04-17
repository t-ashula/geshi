# Scribe API クライアント

Scribe APIを利用するためのTypeScriptクライアントライブラリです。

## インストール

```bash
npm install @geshi/scribe
```

## 基本的な使い方

```typescript
import { ScribeClient } from "@geshi/scribe";

// デフォルト設定でクライアントを初期化
const client = new ScribeClient();

// カスタム設定でクライアントを初期化
const customClient = new ScribeClient({
  baseUrl: "http://custom-api.example.com",
  timeout: 60000,
  pollingInterval: 5000,
  maxPollingAttempts: 20,
});
```

## 文字起こし機能

### 文字起こしリクエスト

音声ファイルをアップロードして文字起こしをリクエストします。

```typescript
// ファイルパスを指定
const requestId = await client.transcribe({
  file: "/path/to/audio.wav",
  language: "ja", // オプション（デフォルト: 'ja'）
  model: "base", // オプション（デフォルト: 'base'）
});

// または Buffer を指定
import * as fs from "fs";
const audioBuffer = fs.readFileSync("/path/to/audio.wav");
const requestId = await client.transcribe({
  file: audioBuffer,
  language: "ja",
  model: "base",
});
```

### 文字起こし結果の取得

リクエストIDを指定して文字起こし結果を取得します。

```typescript
// 完了まで待機（ポーリング）
const result = await client.getTranscription(requestId);
console.log(result.text);
console.log(result.expires_at);

// 待機せずに現在の状態を取得
const status = await client.getTranscription(requestId, false);
if ("text" in status) {
  console.log("完了:", status.text);
} else {
  console.log("処理中:", status);
}
```

## 要約機能

### 要約リクエスト

テキストを送信して要約をリクエストします。

```typescript
const requestId = await client.summarize({
  text: "要約したいテキスト",
  strength: 3, // 要約の強さ（1-5）
});
```

### 要約結果の取得

リクエストIDを指定して要約結果を取得します。

```typescript
// 完了まで待機（ポーリング）
const result = await client.getSummary(requestId);
console.log(result.summary);
console.log(result.expires_at);

// 待機せずに現在の状態を取得
const status = await client.getSummary(requestId, false);
if ("summary" in status) {
  console.log("完了:", status.summary);
} else {
  console.log("処理中:", status);
}
```

## エラーハンドリング

APIクライアントは、エラーが発生した場合に例外をスローします。

```typescript
try {
  const requestId = await client.transcribe({
    file: "/path/to/audio.wav",
  });
  const result = await client.getTranscription(requestId);
  console.log(result);
} catch (error) {
  console.error("エラーが発生しました:", error.message);
}
```

## 設定オプション

`ScribeClient` コンストラクタに渡すことができる設定オプションです。

| オプション         | 説明                             | デフォルト値              |
| ------------------ | -------------------------------- | ------------------------- |
| baseUrl            | Scribe API のベースURL           | '<http://localhost:8002>' |
| timeout            | リクエストタイムアウト（ミリ秒） | 30000                     |
| pollingInterval    | ポーリング間隔（ミリ秒）         | 2000                      |
| maxPollingAttempts | 最大ポーリング回数               | 30                        |

## 型定義

```typescript
// 文字起こしオプション
interface TranscribeOptions {
  file: string | Buffer | Blob;
  language?: string;
  model?: string;
}

// 文字起こし結果
interface TranscriptionResult {
  text: string;
  expires_at: Date;
}

// 要約オプション
interface SummarizeOptions {
  text: string;
  strength: number;
}

// 要約結果
interface SummaryResult {
  summary: string;
  expires_at: Date;
}
```
