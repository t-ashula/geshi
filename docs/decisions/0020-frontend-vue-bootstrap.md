# ADR-0020: Vue による frontend 初期実装を開始する

## ステータス

決定

## 範囲

`frontend/`

## コンテキスト

- ADR-0016 により，frontend の UI フレームワークとして Vue を採用した
- ADR-0018 により，frontend の画面モデルとして，一覧，詳細，検索，管理の 4 画面を基本とする方針が決まっている
- backend 側では ADR-0019 により，Hono による最小 bootstrap が整った
- 次に進むには，`frontend/` でも Vue を前提にした最小の実装骨格を用意したい

## 決定

- `frontend/` に Vue を導入し，初期実装を開始する
- 初期段階では，次を最小スコープとする
  - Vue アプリケーションの起動
  - 1 つの最小画面を表示できる構成
  - 今後画面を追加できる最小のディレクトリ構成
  - backend の `GET /health` を叩く最小の疎通確認
  - frontend 開発用の最小 npm script と手順文書
- 初期実装の目標は，frontend から backend の `GET /health` を呼び出し，`backend server is healthy` のような最小表示ができることとする
- Router，状態管理，UI コンポーネントライブラリ，domain 固有画面，見た目の作り込みはこの段階では導入しない

## 影響

- frontend の実装を着手できる状態になる
- 画面追加や Vue 前提の構成整理を進めやすくなる
- 後続の画面実装や API client 導入の受け皿を作れる

## 代替案

- Vue 導入をさらに後ろへ送る
  - 設計だけが先行し，実装着手が遅れる
- Router や状態管理まで同時に初期化する
  - 初期スコープが広がりすぎる

## 備考

- 本 ADR は frontend の最小 bootstrap を対象とする
- 具体的な package 導入やコード変更は，この ADR を前提に後続コミットで行う

## 参考資料

- [adr-0016] ADR-0016 frontend の UI フレームワークを選定する
- [adr-0018] ADR-0018 frontend の画面モデルを定める
- [adr-0019] ADR-0019 Hono による backend 初期実装を開始する

[adr-0016]: ./0016-frontend-ui-framework-selection.md
[adr-0018]: ./0018-frontend-screen-model.md
[adr-0019]: ./0019-backend-hono-bootstrap.md
