# ADR-0003: frontend の初期アーキテクチャ方針

## ステータス

決定

## 範囲

`frontend/`

## コンテキスト

- Geshi の `frontend/` は Web UI を担う
- 初期段階では，UI フレームワークや状態管理の詳細を早く固定しすぎたくない
- 一方で，開発サーバ，build，型検査，lint といった基盤は先に揃えておきたい
- `frontend/` は，番組表的 UI，メーラー的 UI，管理画面を将来的に受け止める入口になる
- frontend がどこまでを責務として持つかは，backend との境界を決める上でも先に定めておきたい

## 決定

- `frontend/` は Web UI 専用の領域として扱う
- `frontend/` は少なくとも次を責務として持つ
  - podcast / streaming / ordinary rss の閲覧
  - 一覧，絞り込み，全体検索などの探索 UI
  - 音声再生や transcript 表示などの利用 UI
  - source / channel / feed / job 状態の確認 UI
  - 管理画面としての操作 UI
- 初期段階では，以下の基盤だけを先に整える
  - Node.js
  - TypeScript
  - Vite
  - ESLint
- 業務ロジックの正本は backend に置き，`frontend/` は backend の提供する API を利用する側とする
- `frontend/` 自体は，収集処理，検索更新，文字起こし実行，永続化の中心責務を持たない
- UI フレームワーク，状態管理，ルーティング方式は本 ADR では決めない
- まずは「画面を載せられる最小の土台」を作ることを優先する

### 現時点で決めないこと

- React 等の UI フレームワークの採用
- 状態管理ライブラリの採用
- デザインシステムや UI コンポーネント方針
- API 通信ライブラリの採用

## 影響

- Web UI の土台を軽量に立ち上げやすい
- 閲覧・再生・検索・管理の UI 責務が `frontend/` にあることを先に固定できる
- backend との責務分離を明確にしやすくなる
- UI フレームワーク選定を後続の判断に分離できる
- 初期段階で過剰な依存を抱えずに済む

## 代替案

- 最初から UI フレームワークまで固定する
  - 初期判断が増え，現段階では過剰になりやすい
- `frontend/` を独立させず，backend 側に同居させる
  - 役割分離が曖昧になりやすい

## 備考

- 本 ADR は frontend の初期基盤と責務範囲だけを定める
- UI フレームワークや画面設計は別の決定として扱う

## 参考資料

- [adr-0000] ADR-0000 ADR ドキュメントフォーマットと設計ログ
- [adr-0002] ADR-0002 初期ディレクトリ配置として frontend / backend / cli 分離を採用する

[adr-0000]: ./0000-adr-format.md
[adr-0002]: ./0002-initial-layout-separation.md
