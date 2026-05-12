# ADR-0037: source collector plugin 一覧は backend API から frontend に公開する

## ステータス

決定

## 範囲

`api backend`, `web ui frontend`, `plugin`

## コンテキスト

- [ADR-0033] により，built-in / external を問わず source collector plugin は共通 manifest を持つ
- [ADR-0036] により，plugin が source collector plugin であることの識別は manifest の capability で行う
- source 登録 UI で `pluginSlug` を手入力に頼るのは不適切であり，frontend は plugin 一覧から選択できる必要がある
- ただし，frontend が registry や package 構成を直接知るべきではない
- frontend が必要とするのは，source 登録時に候補として提示できる source collector plugin の最小一覧である
- この一覧は，built-in plugin と外部 package plugin を区別せず，同じ source collector plugin 候補として見える必要がある

## 決定

- source collector plugin 一覧は backend API から frontend に公開する
- frontend は source 登録 UI でこの一覧を取得し，`pluginSlug` 選択に使う
- backend は registry に登録済みの source collector plugin から，一覧用の最小 metadata を組み立てて返す
- frontend は registry や manifest 全体を直接扱わず，一覧 API の response だけを扱う

### 一覧 API の責務

- 一覧 API は source collector plugin 候補の表示と選択に必要な情報だけを返す
- 少なくとも次を返す
  - `pluginSlug`
  - `displayName`
  - `description`
  - `sourceKind`
- response は built-in / external の区別を露出しない
- plugin の並び順は backend 側で安定していればよく，初期段階では registry 登録順でよい

### backend 側の責務

- backend は manifest capability を見て source collector plugin として登録された plugin だけを一覧へ含める
- backend は plugin 実装本体や registry 内部表現を response に露出しない
- backend は frontend 向けに必要最小限の DTO を返す

### frontend 側の責務

- frontend は source 登録フォームで plugin 一覧を取得し，選択 UI を提供する
- `inspect` と `create source` の request には，選択された `pluginSlug` を含める
- plugin 一覧の表示名や説明は backend response をそのまま使ってよい

## 影響

- `pluginSlug` を UI で安全に選べるようになる
- `go-jp-rss` のような非 RSS collector も，source 登録 UI に自然に載せられる
- frontend が registry や package 構成に依存せずに済む
- 一方で，plugin 一覧 API と source 登録 UI の整合を保つ責務が backend / frontend 間に増える

## 代替案

- `pluginSlug` を手入力する
  - 入力ミスに弱く，利用可能な plugin 発見性も低いため採らない
- frontend に plugin 定義をハードコードする
  - built-in / external の追加変更が frontend 実装へ漏れるため採らない
- frontend が manifest を直接 import する
  - registry と package 構成の知識が frontend 側へ漏れ，API backend を介した責務分離が崩れるため採らない

## 参考資料

- [ADR-0033] ADR-0033: source collector plugin 契約を外部 package から参照できる公開境界として定義する
- [ADR-0036] ADR-0036: source collector plugin の適用可能性は plugin API で判定する
- [plugin-doc] Plugin

[ADR-0033]: ./0033-source-collector-plugin-api-package-boundary.md
[ADR-0036]: ./0036-source-collector-plugin-applicability-manifest.md
[plugin-doc]: ../plugin.md
