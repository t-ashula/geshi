# @geshi/transcriber

文字起こしAPIクライアントモジュール

## 概要

このモジュールは、文字起こしAPIと通信するためのクライアント機能を提供します。

## 使用方法

```typescript
import { transcribe } from '@geshi/transcriber';

// 使用例
const result = await transcribe({
  audioUrl: 'https://example.com/audio.mp3'
});
```

## 開発

```bash
# 依存関係のインストール
npm install

# テストの実行
npm test

# ビルド
npm run build
