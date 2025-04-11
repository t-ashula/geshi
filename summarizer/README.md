# Summarizer

テキスト要約API

## 概要

このサービスは、テキストの要約を行うAPIを提供します。FastAPIを使用して構築されています。

## 機能

- テキストの要約
- 要約結果の保存と取得
- 要約の長さや形式のカスタマイズ

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

- `POST /api/summarize`: テキストを送信して要約を行う
- `GET /api/summaries`: 要約結果の一覧を取得する
- `GET /api/summaries/{id}`: 特定の要約結果を取得する

## 環境変数

- `DATABASE_URL`: PostgreSQLデータベースの接続URL
- `API_KEY`: 外部APIを使用する場合のAPIキー（オプション）
- `MAX_SUMMARY_LENGTH`: 要約の最大長（デフォルト: 200）
