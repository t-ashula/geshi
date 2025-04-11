# データベーススキーマ設計（日本語仕様）

このドキュメントは、geshi プロジェクトにおける主要なデータベース構造を日本語で定義したものです。Prisma schema 等への変換を前提とした構造的な設計です。

---

## 📁 チャンネル（channels）

- チャンネル（番組）情報を表す
- 主キー: `id`（UUID）
- 公開ID: `slug`（ユニーク、URL用）
- 属性:
  - `title`: チャンネル名
  - `rss_url`: RSS フィードURL（ユニーク）
  - `created_at`, `updated_at`

---

## 📁 エピソード（episodes）

- チャンネル内の配信エピソード
- 主キー: `id`（UUID）
- 公開ID: `slug`
- 外部キー: `channel_id` → `channels.id`
- 属性:
  - `title`
  - `published_at`
  - `audio_url`
  - `type`: 録画種別（例: static, hls, live）
  - `scheduled_at`, `size_bytes`
  - `created_at`, `updated_at`

---

## ⚙️ ジョブ（jobs）

- クローラや要約など非同期処理の記録
- 主キー: `id`（UUID）
- 外部キー: `channel_id`, `episode_id`（任意）
- 属性:
  - `type`: 'crawl', 'download', 'transcribe', 'summarize' など
  - `status`: 'pending', 'working', 'done', 'error'
  - `payload`: JSON
  - `result`: JSON（任意）
  - `started_at`, `finished_at`, `created_at`

---

## 📝 文字起こしリクエスト（transcript_requests）

- エピソードに対しての文字起こし要求
- 主キー: `id`
- 外部キー: `episode_id`
- 属性:
  - `language`: 言語コード
  - `status`
  - `requested_at`
  - `result_id`（transcripts.id）

---

## 📝 文字起こし結果（transcripts）

- 文字起こし全体
- 主キー: `id`
- 外部キー: `request_id`
- 属性:
  - `version`
  - `created_at`
- 関連:
  - `segments`（transcript_segments）

---

## 📃 文字起こしセグメント（transcript_segments）

- 発話の時間帯ごとのテキスト
- 主キー: `id`
- 外部キー: `transcript_id`
- 属性:
  - `start_seconds`, `end_seconds`
  - `text`
  - `speaker`（任意）

---

## 💡 要約リクエスト（summarize_requests）

- 文字起こしをもとに要約生成要求
- 主キー: `id`
- 外部キー: `transcript_id`
- 属性:
  - `strength`
  - `start_seconds`, `end_seconds`
  - `status`, `requested_at`, `result_id`

---

## 💡 要約結果（summaries）

- 要約のまとまり（複数セグメントを含む）
- 主キー: `id`
- 外部キー: `request_id`
- 属性:
  - `generated_at`
- 関連:
  - `segments`（summary_segments）

---

## 📄 要約セグメント（summary_segments）

- トピックごとの要約文（時間付き）
- 主キー: `id`
- 外部キー: `summary_id`
- 属性:
  - `start_seconds`, `end_seconds`
  - `content`

---

## 🔄 エンティティ関係図（簡易）

```plain
Channel 1 ────< Episode 1 ────< TranscriptRequest 1 ────> Transcript 1 ────< TranscriptSegment
                                           └─────> SummarizeRequest 1 ────> Summary 1 ────< SummarySegment
