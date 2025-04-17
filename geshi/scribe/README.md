# @geshi/scribe

Scribe API クライアントライブラリ

## 機能

- 文字起こし（Transcription）APIクライアント
- 要約（Summarization）APIクライアント

## 使用方法

### インストール

```bash
npm install @geshi/scribe
```

### 文字起こし

```typescript
import { ScribeClient } from "@geshi/scribe";

const client = new ScribeClient();

// 文字起こしリクエスト
const requestId = await client.transcribe({
  file: "/path/to/audio.wav",
  language: "ja",
  model: "base",
});

// 文字起こし結果の取得
const result = await client.getTranscription(requestId);
console.log(result.text);
```

### 要約

```typescript
import { ScribeClient } from "@geshi/scribe";

const client = new ScribeClient();

// 要約リクエスト
const requestId = await client.summarize({
  text: "要約したいテキスト",
  strength: 3,
});

// 要約結果の取得
const result = await client.getSummary(requestId);
console.log(result.summary);
```

## API

詳細なAPIドキュメントは[こちら](./docs/api.md)を参照してください。
