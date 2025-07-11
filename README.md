# Geshi

ポッドキャストとメディアコンテンツ処理のための統合プラットフォーム

## 概要

Geshi は、RSS フィードからの自動クローリング、音声ファイルの文字起こし、AI による要約機能を組み合わせた、ポッドキャストとメディアコンテンツ処理のための統合プラットフォームです。コンテンツクリエイター、ポッドキャスター、メディア組織向けに、音声コンテンツの自動発見、ダウンロード、処理機能を提供します。

### 主な機能

- **RSS フィードクローリング**: ポッドキャスト RSS フィードから新しいエピソードを自動発見
- **メディアダウンロード**: ライブ HLS ストリームを含む様々なソースから音声ファイルを取得
- **音声文字起こし**: OpenAI の Whisper モデルを使用した音声からテキストへの変換
- **AI 要約**: トランスフォーマーベースの言語モデルによる簡潔な要約生成
- **Web インターフェース**: チャンネル管理と結果表示のためのユーザーフレンドリーなダッシュボード

## アーキテクチャ

Geshi は二つの主要コンポーネントで構成されています：

### TypeScript モノレポ (`geshi/`)
Web クローリングとデータ管理を担当する npm workspaces 構成：

- **[crawler](./geshi/crawler/)** - RSS クローリングとメディアダウンロード
- **[model](./geshi/model/)** - データベーススキーマと Prisma クライアント  
- **[logger](./geshi/logger/)** - 集約ログユーティリティ
- **[scribe](./geshi/scribe/)** - TypeScript サービスレイヤー
- **[ui](./geshi/ui/)** - SvelteKit Web インターフェース

### Python ML サービス (`scribe/`)
機械学習による文字起こしと要約機能を提供：

- FastAPI による REST API
- Redis Queue を使用したバックグラウンド処理
- Whisper による音声文字起こし
- Transformers による テキスト要約

詳細については [Scribe README](./scribe/README.md) を参照してください。

## 技術スタック

### フロントエンド・バックエンド
- **TypeScript** - モノレポ全体
- **SvelteKit** - Web UI
- **Prisma** - データベース ORM
- **BullMQ** - ジョブキューシステム

### ML・データ処理
- **Python 3.12+** - ML サービス
- **FastAPI** - API フレームワーク
- **OpenAI Whisper** - 音声文字起こし
- **Transformers** - テキスト要約

### インフラストラクチャ
- **PostgreSQL** - メインデータベース
- **Redis** - キューとキャッシュ
- **Docker & Docker Compose** - コンテナ化

## セットアップ

### Docker Compose を使用した起動（推奨）

```bash
# リポジトリのクローン
git clone https://github.com/t-ashula/geshi.git
cd geshi

# 全サービスを起動
docker-compose up -d
```

起動後、以下のサービスが利用可能になります：
- Web UI: http://localhost:3000
- Scribe API: http://localhost:8002
- PostgreSQL: localhost:5432
- Redis: localhost:6379

### ローカル開発環境

#### 前提条件
- Node.js 18+ と npm
- Python 3.12+ と Poetry
- PostgreSQL
- Redis

#### TypeScript モノレポのセットアップ

```bash
cd geshi
npm install
npm run build
```

#### Python ML サービスのセットアップ

```bash
cd scribe
poetry install
```

## 開発

### 全体のビルドとテスト

```bash
# TypeScript モノレポ
cd geshi
npm run build    # 全ワークスペースをビルド
npm run test     # 全ワークスペースのテストを実行
npm run lint     # 全ワークスペースの Lint を実行

# Python サービス
cd scribe
poetry run pytest              # テスト実行
poetry run isort . && poetry run black .  # フォーマット
```

### 個別モジュールの開発

各モジュールの詳細な開発手順については、それぞれの README を参照してください：

- [Crawler](./geshi/crawler/README.md) - RSS クローリングとメディア処理
- [Model](./geshi/model/README.md) - データベースモデルと Prisma
- [Logger](./geshi/logger/README.md) - ログ機能
- [Scribe Client](./geshi/scribe/README.md) - TypeScript API クライアント
- [UI](./geshi/ui/README.md) - SvelteKit Web アプリケーション
- [Scribe Service](./scribe/README.md) - Python ML サービス

## API 使用例

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

// 結果の取得
const result = await client.getTranscription(requestId);
console.log(result.text);
```

### 要約

```typescript
// 要約リクエスト
const requestId = await client.summarize({
  text: "要約したいテキスト",
  strength: 3, // 1-5 の詳細レベル
});

// 結果の取得
const result = await client.getSummary(requestId);
console.log(result.summary);
```

## ライセンス

[MIT License](./LICENSE)
