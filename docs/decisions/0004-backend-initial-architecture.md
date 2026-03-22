# ADR-0004: backend の初期アーキテクチャ方針

## ステータス

決定

## 範囲

`backend/`

## コンテキスト

- Geshi の `backend/` は API，収集，保存，検索，外部 API 連携などのサーバ側責務を持つ
- backend は今後，取得系と保存系の中心になる
- 初期段階では API フレームワークやジョブ基盤をまだ固定したくない
- ただし，backend がどこまでを責務として持つかは先に定めておきたい

## 決定

- `backend/` はサーバ側責務の入口として扱う
- `backend/` は少なくとも次を責務として持つ
  - Web API の提供
  - podcast / streaming / ordinary rss の収集処理
  - 保存対象メタデータの管理
  - 全文検索のための更新処理
  - 外部 API との連携
  - 文字起こし結果の保存と利用
- `backend/` は CLI から呼ばれるユースケースの正本でもある
- CLI 独自の業務ロジックは極力持たず，CLI から必要な処理は backend 側に寄せる
- 将来的には，CLI から backend の HTTP API を呼ぶだけで成立する形へ寄せる
- 初期段階では，[adr-0002] にもとづいて以下の基盤だけを先に整える
  - Node.js
  - TypeScript
  - ESLint
- API フレームワーク，ジョブ実行方式，永続化ライブラリ，検索基盤の詳細は本 ADR では決めない
- `backend/` の内部フォルダ構成は本 ADR では決めない
- backend は，後続 ADR で API，収集，保存，検索の構造を詰める前提の土台とする

### 現時点で決めないこと

- API フレームワークの採用
- worker / job モデル
- ORM / query builder の採用
- 検索インデックス方式
- backend 内の詳細なサブディレクトリ構成

## 影響

- backend の責務境界を早い段階で分離できる
- API / 収集 / 検索 / 外部連携が backend の責務であることを先に固定できる
- CLI との責務境界を明確にしやすくなる
- サーバフレームワーク選定を後続へ送れる
- frontend / cli と言語を揃えつつ，設計の自由度を残せる

## 代替案

- backend を frontend に同居させる
  - 一般的な front / back 分離に反する
- 最初から API フレームワークやジョブ基盤まで固定する
  - 要件整理前には早すぎる

## 備考

- 本 ADR は backend の責務範囲と初期基盤だけを定める
- API や crawler などの詳細構造は別 ADR で扱う

## 参考資料

- [adr-0000] ADR-0000 ADR ドキュメントフォーマットと設計ログ
- [adr-0002] ADR-0002 初期ディレクトリ配置として frontend / backend / cli 分離を採用する
- [adr-0005] ADR-0005 cli の初期アーキテクチャ方針

[adr-0000]: ./0000-adr-format.md
[adr-0002]: ./0002-initial-layout-separation.md
