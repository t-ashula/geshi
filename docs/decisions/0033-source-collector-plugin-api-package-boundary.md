# ADR-0033: source collector plugin 契約を外部 package から参照できる公開境界として定義する

## ステータス

提案

## 範囲

`plugin`, `api backend`, `crawler`

## コンテキスト

- 現在の source collector plugin 契約は `backend/src/plugins/types.ts` にあり，plugin 実装配置も `backend/src/plugins/` 配下にある
- [ADR-0011] と [plugin-doc] により，source collector plugin は `backend` の domain model 更新責務から分離されているが，型定義と公開境界の所有者は依然として `backend` 側に寄っている
- [ADR-0032] では plugin 解決責務を registry interface 境界へ寄せたが，registry が返す契約自体はまだ `backend` が所有している
- この状態では，外部 package で plugin を実装しようとしても，`backend` 内部 module に依存し続けるため，plugin 追加の公開拡張点としては成立しない
- `geshi` は podcast RSS 以外の source を扱う前提であり，plugin 追加を repository 内部 module 変更に固定すると拡張単位が粗すぎる
- sample として非 RSS HTML page を source 化する plugin を追加したいが，そのためにも plugin 契約を `backend` の内部実装から分離する必要がある

## 決定

- source collector plugin 契約は，外部 package から参照できる公開境界として定義する
- `backend` は plugin 契約の consumer になり，契約定義の owner にはならない
- source collector plugin 用の公開 package を設け，少なくとも次をそこへ置く
  - `SourceCollectorPlugin`
  - `supports` / `inspect` / `observe` / `acquire` の input / output 型
  - plugin manifest 型
  - plugin API version
  - plugin が受け取れる最小 logger interface
- `backend` の registry は，上記の公開契約にだけ依存して plugin を受け取る
- `backend` は内蔵 plugin 実装を持ってよい
- ただし，内蔵 plugin も外部 package plugin も，同じ公開契約を満たすものとして registry に登録する

### 公開境界の原則

- 公開契約 package は，`backend` の repository / service / endpoint / DB 型を export しない
- plugin は `backend` の domain model を直接更新しないという既存原則を維持する
- plugin が受け取る logger は，実装依存の concrete class ではなく最小 interface とする
- built-in / external を問わず，すべての plugin は manifest を持つ
- plugin manifest には，少なくとも `pluginSlug`，`displayName`，plugin API version，capability 情報を含める
- `pluginSlug` は package 名と分離した論理識別子として扱う
- plugin 固有の継続状態が必要な場合，その保存主体は plugin ではなく `backend` とする
- plugin 公開契約は，`collectorPluginState` を input として受け取り，必要に応じて次回実行用 state を output として返せる形にしてよい

### manifest の役割

- manifest は，plugin が何者で何ができるかを backend が先に知るための公開 metadata とする
- source collector plugin であることの識別は，実装配置や import 元ではなく manifest の capability 宣言で行う
- この原則は，built-in plugin と外部 package plugin の両方に同じように適用する

### registry への影響

- registry は「どの plugin があるか」を知るが，「plugin 契約の型定義」は所有しない
- registry 実装は，静的 import による内蔵 plugin 登録から始めてよい
- ただし，built-in plugin でも外部 package plugin でも，manifest を読んだうえで capability ごとに registry へ登録する
- それに加えて，外部 package が export する plugin を同じ流儀で registry へ追加登録できるようにする
- 将来的な動的 import や設定ファイル経由登録は，この境界の上に追加してよい

### 既存 plugin との関係

- 既存 `podcast-rss` plugin は，まず公開契約に従う内蔵 plugin として維持してよい
- 既存 `podcast-rss` plugin にも，built-in plugin として manifest を追加する
- `podcast-rss` を外部 package 化するかどうかは，この ADR の必須スコープに含めない
- 外部 package plugin 追加後も，既存内蔵 plugin の `inspect` / `observe` / `acquire` の振る舞いと既存 DB / job 実行経路は維持する
- `backend` 側の service / worker test は，引き続き fake registry を注入する
- plugin 自体の test は，内蔵 plugin なら repository 内で，外部 package plugin なら package 単位で行う

## 影響

- plugin の追加を，`backend` 本体改変なしでも行える公開拡張点として扱いやすくなる
- built-in / external で plugin 識別と登録の流儀を揃えられる
- `backend` と plugin の責務境界が，型定義の所有権まで含めて揃う
- `podcast-rss` 以外の plugin を sample や別 repository で育てやすくなる
- cursor や補助 metadata を必要とする plugin も，同じ公開境界の上で扱いやすくなる
- 一方で，plugin API version と互換性判定を運用する責務が増える
- monorepo 内 package と repository 外 package の両方を視野に入れた build / test 設計が別途必要になる

## 代替案

- plugin 実装だけ外部 package にし，契約型は引き続き `backend` が所有する
  - 依存方向が `backend` 内部へ向いたままで，公開拡張点の境界が不完全なため採らない
- `backend` が plugin 契約も registry も内蔵 plugin 実装も引き続き持ち，plugin 追加時だけ repository を編集する
  - 外部 package から plugin を追加する拡張点を提供できないため採らない
- 最初から plugin を別 process / RPC 越しに実行する
  - 現在の plugin 契約は in-process 呼び出しを前提としており，段階的移行のコストが高すぎるため採らない

## 参考資料

- [ADR-0011] ADR-0011: source クロールを plugin 境界で拡張可能にする
- [ADR-0023] ADR-0023: source collector plugin に source 登録前 inspect API を追加する
- [ADR-0032] ADR-0032: source collector plugin 解決を registry interface 境界へ寄せる
- [ADR-0035] ADR-0035: plugin 固有の継続状態は collector setting とは分けて backend が保持する
- [plugin-doc] Plugin

[ADR-0011]: ./0011-source-crawl-plugin-responsibilities.md
[ADR-0023]: ./0023-source-registration-inspect-plugin-api.md
[ADR-0032]: ./0032-source-collector-plugin-registry-boundary.md
[ADR-0035]: ./0035-plugin-owned-state-storage.md
[plugin-doc]: ../plugin.md
