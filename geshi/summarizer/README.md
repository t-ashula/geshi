# @geshi/summarizer

要約APIクライアントモジュール

## 概要

このモジュールは、テキスト要約APIと通信するためのクライアント機能を提供します。

## 使用方法

```typescript
import { summarize } from '@geshi/summarizer';

// 使用例
const result = await summarize({
  text: 'ここに要約したいテキストを入力します。長文のテキストを短く要約するためのAPIです。'
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
