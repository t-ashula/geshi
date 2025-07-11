# Geshi

文字起こしと要約のためのプロジェクト

## 概要

Geshi は音声ファイルの文字起こしとテキストの要約機能を提供する統合プラットフォームです。TypeScript monorepo (geshi/) と Python サービス (scribe/) で構成されており、RSS フィードからのポッドキャスト取得、音声ダウンロード、文字起こし、要約までの一連の処理を自動化します。

## アーキテクチャ

- **geshi/**: TypeScript monorepo (npm workspaces)
  - `crawler/`: RSS クローリングとメディアダウンロード
  - `model/`: データベーススキーマと Prisma クライアント
  - `logger/`: 集約ログユーティリティ
  - `scribe/`: TypeScript サービス層
  - `ui/`: SvelteKit Web インターフェース
- **scribe/**: Python ML サービス (Poetry)
  - FastAPI アプリケーション
  - 音声文字起こしとテキスト要約

## 開発環境セットアップ

### 前提条件

- Node.js 18+ 
- Python 3.12+
- Poetry
- PostgreSQL
- Redis
- Docker と Docker Compose (オプション)

### 方法1: Docker Compose を使用 (推奨)

```bash
# リポジトリのクローン
git clone https://github.com/t-ashula/geshi.git
cd geshi

# Docker Compose でサービスを起動
docker-compose up -d

# サービスの確認
docker-compose ps
```

サービスは以下のポートで利用可能になります：
- UI: http://localhost:3000
- Scribe API: http://localhost:8002
- PostgreSQL: localhost:5432
- Redis: localhost:6379

### 方法2: ローカル開発環境

#### 1. 依存関係のインストール

```bash
# リポジトリのクローン
git clone https://github.com/t-ashula/geshi.git
cd geshi

# TypeScript monorepo の依存関係インストール
cd geshi
npm install

# Python サービスの依存関係インストール
cd ../scribe
poetry install
```

#### 2. 環境変数の設定

`.env` ファイルを作成し、以下の環境変数を設定：

```bash
# データベース
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/geshi

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# アップロードディレクトリ
GESHI_UPLOAD_DIR=tmp/uploads
```

#### 3. データベースとRedisの起動

```bash
# PostgreSQL と Redis を Docker で起動
docker run -d --name geshi-postgres -p 5432:5432 -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=geshi postgres:16
docker run -d --name geshi-redis -p 6379:6379 redis:alpine
```

#### 4. データベースマイグレーション

```bash
cd geshi/model
npx prisma migrate dev
```

#### 5. サービスの起動

各サービスを別々のターミナルで起動：

```bash
# Scribe API サーバー
cd scribe
poetry run uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload

# Scribe ワーカー
cd scribe
poetry run python -m src.worker

# Scribe スケジューラー
cd scribe
poetry run python -m src.scheduler

# UI (開発サーバー)
cd geshi/ui
npm run dev
```

## 開発コマンド

### TypeScript monorepo (geshi/)

```bash
cd geshi

# 全ワークスペースのビルド
npm run build

# 全ワークスペースのテスト実行
npm run test

# 全ワークスペースのリント実行
npm run lint

# 全ワークスペースのフォーマット
npm run format
```

### Python サービス (scribe/)

```bash
cd scribe

# テストの実行
poetry run pytest

# リンターの実行
poetry run isort . && poetry run black .
```

## API エンドポイント

### 文字起こし
- `POST /transcribe`: 音声ファイルをアップロードして文字起こしジョブを登録
- `GET /transcribe/{request_id}`: 文字起こし結果の取得

### 要約
- `POST /summarize`: テキストを送信して要約ジョブを登録
- `GET /summarize/{request_id}`: 要約結果の取得

## ライセンス

MIT License
