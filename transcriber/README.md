# Transcriber

文字起こしAPI

## 概要

このサービスは、音声ファイルから文字起こしを行うAPIを提供します。FastAPIを使用して構築されています。

## 機能

- 音声ファイルのアップロード
- 音声ファイルからのテキスト抽出
- 文字起こし結果の保存と取得

## 開発環境のセットアップ

```bash
# 依存関係のインストール
poetry install

# 開発サーバーの起動
poetry run uvicorn src.main:app --reload

# テストの実行
poetry run pytest
```

## API エンドポイント

- `POST /api/transcribe`: 音声ファイルをアップロードして文字起こしを行う
- `GET /api/transcriptions`: 文字起こし結果の一覧を取得する
- `GET /api/transcriptions/{id}`: 特定の文字起こし結果を取得する

## 環境変数

- `DATABASE_URL`: PostgreSQLデータベースの接続URL
- `API_KEY`: 外部APIを使用する場合のAPIキー（オプション）
