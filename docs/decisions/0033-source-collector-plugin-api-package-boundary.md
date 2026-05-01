# ADR-0033: source collector plugin 契約を backend から分離した package 境界として定義する

## ステータス

提案

## 範囲

`plugin`, `api backend`, `crawler`

## コンテキスト

- 現在の source collector plugin 契約は `backend/src/plugins/types.ts` にあり，plugin 実装配置も `backend/src/plugins/` 配下にある
- [ADR-0011] と [plugin-doc] により，source collector plugin は `backend` の domain model 更新責務から分離されているが，型定義と公開境界の所有者は依然として `backend` 側に寄っている
- [ADR-0032] では plugin 解決責務を registry interface 境界へ寄せたが，registry が返す契約自体はまだ `backend` が所有している
- この状態では，plugin を別 package へ切り出しても，外部 package が `backend` 内部 module に依存し続けるため，実質的には内蔵 plugin のままである
- `geshi` は podcast RSS 以外の source を扱う前提であり，plugin 追加を repository 内部 module 変更に固定すると拡張単位が粗すぎる
- sample として非 RSS HTML page を source 化する plugin を追加したいが，そのためにも plugin 契約を `backend` の内部実装から分離する必要がある

## 決定

- source collector plugin 契約は，`backend` から分離した外部 package が所有する
- `backend` は plugin 契約の consumer になり，契約定義の owner にはならない
- source collector plugin 用の公開 package を設け，少なくとも次をそこへ置く
  - `SourceCollectorPlugin`
  - `inspect` / `observe` / `acquire` の input / output 型
  - plugin manifest 型
  - plugin API version
  - plugin が受け取れる最小 logger interface
- `backend` の registry は，上記の公開契約にだけ依存して plugin を受け取る
- 標準 plugin であっても，実装は `backend` のソースツリーに埋め込まず，外部 package と同じ境界で扱える構成を目指す

### 公開境界の原則

- 公開契約 package は，`backend` の repository / service / endpoint / DB 型を export しない
- plugin は `backend` の domain model を直接更新しないという既存原則を維持する
- plugin が受け取る logger は，実装依存の concrete class ではなく最小 interface とする
- plugin manifest には，少なくとも `pluginSlug`，plugin kind，plugin API version を含める
- `pluginSlug` は package 名と分離した論理識別子として扱う

### registry への影響

- registry は「どの plugin があるか」を知るが，「plugin 契約の型定義」は所有しない
- registry 実装は，静的 import による標準 plugin 登録から始めてよい
- ただし，登録対象は `backend` 内部 module ではなく，公開契約に従う package export として受け取れるようにする
- 将来的な動的 import や設定ファイル経由登録は，この境界の上に追加してよい

### 既存 plugin の移行方針

- 既存 `podcast-rss` plugin は，まず公開契約 package を参照するように移し，その後で実装 package として分離する
- 移行の過程でも，`inspect` / `observe` / `acquire` の振る舞いと既存 DB / job 実行経路は維持する
- `backend` 側の service / worker test は，引き続き fake registry を注入する
- plugin 自体の test は，package 単位で実 plugin を import して行う

## 影響

- plugin の追加や差し替えを，`backend` 直接改変より小さな配布単位で扱える
- `backend` と plugin の責務境界が，型定義の所有権まで含めて揃う
- `podcast-rss` 以外の plugin を sample や別 repository で育てやすくなる
- 一方で，plugin API version と互換性判定を運用する責務が増える
- monorepo 内 package と repository 外 package の両方を視野に入れた build / test 設計が別途必要になる

## 代替案

- plugin 実装だけ外部 package にし，契約型は引き続き `backend` が所有する
  - 依存方向が `backend` 内部へ向いたままで，外部 package 化の境界が不完全なため採らない
- `backend` が plugin 契約も registry も標準 plugin 実装も引き続き持ち，plugin 追加時だけ repository を編集する
  - 拡張単位が repository 改変に固定されるため採らない
- 最初から plugin を別 process / RPC 越しに実行する
  - 現在の plugin 契約は in-process 呼び出しを前提としており，段階的移行のコストが高すぎるため採らない

## 参考資料

- [ADR-0011] ADR-0011: source クロールを plugin 境界で拡張可能にする
- [ADR-0023] ADR-0023: source collector plugin に source 登録前 inspect API を追加する
- [ADR-0032] ADR-0032: source collector plugin 解決を registry interface 境界へ寄せる
- [plugin-doc] Plugin

[ADR-0011]: ./0011-source-crawl-plugin-responsibilities.md
[ADR-0023]: ./0023-source-registration-inspect-plugin-api.md
[ADR-0032]: ./0032-source-collector-plugin-registry-boundary.md
[plugin-doc]: ../plugin.md
