# @geshi/crawler

クローラーモジュール

## 概要

このモジュールは、Webページやその他のソースからデータを収集するためのクローラー機能を提供します。
BullMQを使用したジョブキューシステムを実装しており、クロール、ダウンロード、録画予約などの処理を非同期で実行します。

## 使用方法

### 基本的な使用方法

```typescript
import { crawler } from "@geshi/crawler";

// チャンネル一覧を取得
const channels = await crawler.producer.listChannels();

// エピソード一覧を取得
const episodes = await crawler.producer.listEpisodes({ limit: 10 });

// 手動でジョブを生成
await crawler.producer.produceAllJobs();
```

### スケジュールジョブの設定

produceAllJobs を5分ごとに実行するスケジュールジョブを設定できます。BullMQ の JobsScheduler を使用して、cron 形式のパターンでジョブをスケジュールします。

```typescript
import { setupScheduledJobs, closeAllSchedulers } from "@geshi/crawler";

// スケジュールジョブを設定
await setupScheduledJobs();

// アプリケーション終了時にスケジューラーを閉じる
process.on("SIGTERM", async () => {
  await closeAllSchedulers();
  process.exit(0);
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
```
