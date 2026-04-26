# Design Log 0008

`ADR-0008` の補足メモ．

## 固定した事項

- DB は PostgreSQL
- ローカル開発環境とテスト環境では `docker compose` で PostgreSQL 18 を起動する
- DB アクセスは Kysely を使う
- Kysely の DB 型定義の生成には `kysely-codegen` を使う
- schema 定義の正本は `db/schema.sql` とする
- schema 差分適用には `psqldef` を使う
- 初回 schema は `source` / `sourceSnapshot` を中心にし，ID は UUID v7 にする
- UUID v7 の生成は当面アプリケーション側で行う

## この段階で残す詳細検討

- DB を含めたテスト方針をどう別 ADR に切り出すか

## メモ

- `psqldef` 採用により，連番 migration ファイルの競合調停は避けやすい
- 一方で，schema SQL のレビュー品質がそのまま migration 品質に効くため，DDL のレビュー観点は別途揃える必要がある

## 現時点の想定 DDL

```sql
create table sources (
  id uuid primary key,
  slug varchar(128) not null unique,
  kind text not null,
  url text not null,
  url_hash text not null unique,
  created_at timestamptz not null default current_timestamp,
  check (kind in ('podcast'))
);

create table source_snapshots (
  id uuid primary key,
  source_id uuid not null references sources(id),
  version integer not null,
  title text,
  description text,
  recorded_at timestamptz not null default current_timestamp,
  unique (source_id, version)
);

create index sources_created_at_idx on sources (created_at);
create index source_snapshots_version_idx on source_snapshots (version);
```

## 補足

- `kind` は現時点では `podcast` のみを想定する
- `sources.slug` は source の公開用・可読用識別子として持ち，一意制約を置く
- `sources.slug` の最大長は 128 文字とする
- UUID を主キーに使っても，利用者向けや URL 向けには `id` 自体を露出しない前提にする
- `sources.url` は source の固定属性として持つ
- `sources.url_hash` はアプリケーション側で計算した値を入れ，一意制約で source の重複登録を防ぐ
- `sources.url_hash` の形式は `<hash-alg>:<hash-value>` とし，どのハッシュアルゴリズムで計算したかを値自体に含める
- `source_snapshots.version` は `source_id` ごとの版番号とする
- 初回登録時の snapshot は `version = 1` とする
- URL 変更後は同一 source としては扱わず，別 source として登録する
- 同一「Channel」の source 移転をどう束ねるかは，将来 `source` の上位概念で吸収する
- source のクロール有効 / 無効や巡回間隔のような運用設定は `source` 本体には入れず，後続の crawl 設定で吸収する
- crawl 設定の詳細な schema は，crawl 機能の実装段階で別途決める
- index は当面 `sources.slug`, `sources.url_hash`, `sources.created_at`, `source_snapshots.version` を持つ
- DB や migration を含めたテスト方針は，次の機能開発までの別 ADR に切り出して決める
