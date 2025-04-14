# Transcriber API

FastAPI + RQ（Redis Queue）を使用した音声文字起こしAPIです。

## 機能

- 音声ファイル（.wav形式）のアップロードと非同期処理
- 文字起こし結果の取得
- Redis を使用した結果の一時保存（TTL: 24時間）
- 自動クリーンアップ処理

## 技術スタック

- Python 3.12
- FastAPI
- Redis
- RQ (Redis Queue)
- RQ Scheduler

## セットアップ

### 前提条件

- Python 3.12
- Poetry
- Redis サーバー

### インストール

```bash
# 依存関係のインストール
poetry install
```

### 環境変数

以下の環境変数を設定できます（オプション）：

- `REDIS_HOST`: Redis サーバーのホスト名（デフォルト: localhost）
- `REDIS_PORT`: Redis サーバーのポート番号（デフォルト: 6379）
- `REDIS_DB`: Redis のデータベース番号（デフォルト: 0）

## 実行方法

### API サーバーの起動

```bash
# Poetry 環境内で実行
poetry run python src/main.py
```

または

```bash
# uvicorn を直接使用
poetry run uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
```

### ワーカーの起動

```bash
# RQ ワーカーの起動
poetry run python src/worker.py
```

### スケジューラの起動

```bash
# クリーンアップスケジューラの起動
poetry run python src/scheduler.py
```

## API エンドポイント

### `POST /transcribe`

音声ファイルをアップロードして文字起こしを行います。

#### リクエスト

- Content-Type: `multipart/form-data`
- パラメータ:
  - `file`: `.wav` 形式の音声ファイル（必須）
  - `language`: 文字起こし対象言語（デフォルト: `ja`）
  - `model`: 使用モデル名（デフォルト: `base`）

#### レスポンス

- 成功時 (202 Accepted):

  ```json
  {
    "request_id": "01HZX..."
  }
  ```

- エラー時 (400 Bad Request):

  ```json
  {
    "error": "unsupported file format"
  }
  ```

### `GET /transcribe/{request_id}`

文字起こし結果を取得します。

#### レスポンス

- 処理完了時 (200 OK):

  ```json
  {
    "status": "done",
    "text": "これはサンプルの文字起こしテキストです。",
    "expires_at": "2025-04-11T15:00:00Z"
  }
  ```

- 処理中 (200 OK):

  ```json
  {
    "status": "pending"
  }
  ```

  または

  ```json
  {
    "status": "working"
  }
  ```

- エラー発生時 (200 OK):

  ```json
  {
    "status": "error",
    "error": "whisper crashed"
  }
  ```

- リクエスト ID が存在しない場合 (404 Not Found):

  ```json
  {
    "error": "request not found"
  }
  ```

## 注意事項

- 現在の実装では、実際の文字起こし処理は仮実装です。実際の文字起こしエンジン（例：Whisper）と連携するには、`transcription.py` の `process_transcription` 関数を修正してください。
- 本番環境では、適切な認証・認可の実装を検討してください。
- アップロードファイルのサイズ制限は 1GiB です。
