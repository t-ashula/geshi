# ADR-0003: 全体アーキテクチャ

## ステータス

決定

## 範囲

全体

## コンテキスト

- `geshi` は podcast，streaming，feed を継続収集し，保存し，あとから閲覧・検索・再利用できる個人用アーカイブを目指している
- 早い段階で主要コンポーネントの分担を定めておかないと，収集系，閲覧系，管理系の責務が混ざりやすい
- 特に Web UI，API，収集処理，保存先の境界は，後から崩すと修正コストが高い
- 一方で，パッケージ構成や個別 API 仕様まで ADR で固定すると変更しづらくなる

## 決定

全体アーキテクチャとして当面，以下の構成とする

- `web ui frontend`
  - 閲覧，検索，管理画面を担当する
- `api backend`
  - frontend や CLI からの要求を受け，収集結果，メタデータ，検索，保存操作を扱う
- `crawler`
  - podcast，streaming，feed などの外部 source から継続的に収集する
- `cli`
  - 管理，保守，バッチ実行の入口を担当する
- `storage`
  - 収集済みメディア，メタデータ，検索用 index などを保持する

### 各コンポーネントの責務

- `web ui frontend` は表示と操作受付に責務を限定する
- `api backend` は業務ロジック，検索，保存操作の調停を担当する
- `crawler` は外部 source との接続と収集処理を担当する
- `cli` は対話的操作よりも管理・保守・自動化の入口とする
- `storage` は各コンポーネントから共有される永続化先とする

### 通信方向

- `web ui frontend` は `api backend` を利用する
- `crawler` は収集結果を `api backend` に渡してよい
- `crawler` は収集したファイルを `storage` に直接保存してよい
- `cli` は `api backend` を利用するか，必要時に直接保守処理を実行する
- `api backend` は `storage` を利用する

### 拡張方針

- 外部 source の追加は主に `crawler` 側の拡張で実現する
- 閲覧や管理機能の追加は `web ui frontend` と `api backend` の協調で実現する
- 保存形式や検索方式の変更は `storage` と `api backend` の範囲で吸収する

### 主なデータフロー

- `crawler` が外部 source からコンテンツと metadata を取得する
- 取得結果の metadata や管理対象情報を `api backend` に渡す
- 取得したファイル本体は必要に応じて `storage` に直接保存する
- `api backend` が検索や閲覧用にデータを整える
- `web ui frontend` と `cli` がそれを利用する

### 非機能上の優先事項

- エラー時は原因と失敗箇所を追いやすい形で扱えるようにする
- 継続収集，閲覧，検索を各コンポーネントで分担しやすい構成にする

### この ADR で固定しないもの

- ディレクトリ名やパッケージ名の最終形
- frontend と backend 間の API 詳細
- crawler のジョブ実行方式
- storage の具体実装
- Web UI の具体的画面構成

詳細や今後の変更は [system-architecture] を正とする．

## 影響

- 主要コンポーネントと通信方向が先に固まる
- 閲覧系，収集系，管理系の責務を分けて進めやすくなる
- frontend / backend / crawler を別々に具体化しやすくなる
- 実装詳細は別文書側で更新できるため，ADR を過度に肥大化させずに済む

## 代替案

- 単一アプリケーションにまとめて実装し，後で分割する
  - 初速は出るが，収集系と閲覧系の責務分離が後手になりやすい
- crawler を持たず，backend が収集も兼ねる
  - 単純だが，継続収集やバッチ実行の責務が backend に集中しやすい
- Web UI を持たず，CLI のみで始める
  - 実装は軽いが，閲覧系の主要要件を先送りにしやすい

## 備考

- 本 ADR は主要コンポーネントと通信方向を定めるものであり，API や画面詳細までは定めない

## 参考資料

- [adr-0002] ADR-0002 開発項目駆動の開発フローを採用する
- [system-architecture] System Architecture

[adr-0002]: ./0002-development-flow.md
[system-architecture]: ../system-architecture.md
