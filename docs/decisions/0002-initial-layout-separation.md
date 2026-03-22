# ADR-0002: 初期ディレクトリ配置として frontend / backend / cli 分離を採用する

## ステータス

決定

## 範囲

全体

## コンテキスト

- Geshi は当面 monorepo 構成を採らず，単一リポジトリとして再始動する
- ただし，Web UI，API/サーバ側処理，CLI 管理系は責務が異なり，最初からある程度分離しておきたい
- 一般的な frontend + backend + cli の分離を前提にしたい
- 現段階では tech stack は Node.js / TypeScript / Vite / ESLint を維持したいが，内部の詳細構造まではまだ決めたくない
- 早すぎる詳細設計を避けつつ，後から整理不能にならない最小限の初期配置方針が必要である

## 決定

- 初期ディレクトリ配置は，少なくとも以下の責務分離を前提にする
  - `frontend/`
  - `backend/`
  - `cli/`
- `frontend/` は Web UI を置く領域とする
- `backend/` は API，収集，保存，検索，外部 API 連携など，サーバ側責務を置く領域とする
- `cli/` は管理コマンド，運用コマンド，保守コマンドを置く領域とする
- 共有定義が必要になった場合に備えて，`shared/` を追加候補として扱う
- 開発補助や移行補助は，必要に応じて `scripts/` を置く
- `frontend/`，`backend/`，`cli/` の共通前提として，少なくとも以下は揃える
  - Node.js
  - TypeScript
  - ESLint
- つまり，各領域で責務は分けるが，実装言語と最低限の静的検査基盤は共通化する

### 現時点で決めること

- monorepo にはしない
- frontend / backend / cli は初期段階から分ける
- ただし，それぞれの内部構造は現時点では固定しない

### 現時点で決めないこと

- `frontend/` のフレームワーク詳細
- `backend/` をさらに `api/` と `worker/` に分割するかどうか
- `shared/` を最初から置くか，後から導入するか
- package 管理を単一 `package.json` にするか，サブディレクトリごとに持つか
- build / test / lint の束ね方

## 影響

- 役割の異なるコードを最初から物理的に分離できる
- Web UI と CLI と backend の責務境界が見えやすくなる
- monorepo より軽量なまま，将来の拡張や再編に備えられる
- 一方で，`shared/` や build 手順などの詳細は後続の決定が必要になる

## 代替案

- ルート直下の `src/` にすべてをまとめる
  - 初速は速いが，frontend / backend / cli の責務境界が曖昧になりやすい
- 最初から monorepo / workspace 構成にする
  - 将来性はあるが，現段階では運用と設定が重い
- backend 中に CLI を内包し，`frontend/` と `backend/` の二分割だけにする
  - 管理系コードとサーバ系コードが混ざりやすい

## 備考

- 本 ADR は初期配置の方針を定めるものであり，詳細な build 構成や実行構成までは定めない
- 採択後，必要に応じて `shared/` や `scripts/` の扱いを別 ADR で補う

## 参考資料

- [adr-0000] ADR-0000 ADR ドキュメントフォーマットと設計ログ
- [concept] Geshi Concept

[adr-0000]: ./0000-adr-format.md
[concept]: ../concept.md
