# ADR-0064: source をまたいで同じ pluginSlug で共有される実行時状態は source 状態と分けて host が保持する

## ステータス

決定

## 範囲

`geshi-sdk`, `api backend`, `crawler`, external plugins

## コンテキスト

- [ADR-0035] は，source collector plugin の継続状態を `collector setting` 単位で保持し，`pluginSlug` だけを key にした source 横断共有 state を採らない方針を定めている
- この方針は，`lastProcessedUrl` や cursor のような source ごとの観測進捗を扱うには自然である
- 一方で，特定 service へのログイン済み session，service 共通 cookie jar，plugin 内で共有したい rate limit 情報，service 側都合で更新される session metadata のように，source と独立して，同じ `pluginSlug` の実行間で source をまたいで共有したい mutable な情報もありうる
- これらを `collectorPluginState` へ入れると，source ごとの観測進捗と plugin 全体共有の実行文脈とが混ざる
- 逆に，これらを `collector_setting.config` へ入れると，人や API が与える source ごとの入力設定と，plugin 実行が更新する内部状態とが混ざる
- [ADR-0030] の方針に従えば，app 全体設定の置き場へ plugin 実行時状態を混在させるのも望ましくない
- plugin が source と無関係な共有情報を必要とする場合でも，plugin 自身が勝手に任意の永続領域を持つのではなく，host 側が責任を持って扱える形に寄せた方が再現性と運用性を保ちやすい
- [ADR-0060] は，plugin 実行 capability を host object 経由で公開する方針を定めており，この種の共有状態 access も host capability として寄せるのが自然である

## 決定

- source をまたいで同じ `pluginSlug` の実行間で共有したい mutable な実行時情報は，`collectorPluginState` とは別の概念として扱う
- この状態は，少なくとも `pluginSlug` 単位で識別される plugin global runtime state として扱う
- plugin global runtime state は，source や `collector setting` に従属させない
- plugin global runtime state の保存主体は plugin 自身ではなく host とする
- plugin は，host object を通じて plugin global runtime state を読み書きする
- host は，少なくとも version 付き read/write API を提供し，silent overwrite はしない
- plugin global runtime state の意味論や conflict 時の再試行・merge 方針は plugin の責務とする
- plugin からの access は，同じ `pluginSlug` の実行文脈に閉じ，異なる `pluginSlug` の state へはアクセスできない
- `collectorPluginState` は，引き続き source ごとの継続状態だけに使う
- `collector_setting.config` は，引き続き人や API が与える source ごとの入力設定だけに使う
- `app_settings` は，引き続き app 全体設定として扱い，plugin 実行時状態の置き場にはしない

### plugin global runtime state の位置づけ

- plugin global runtime state は，source をまたいで同じ `pluginSlug` の実行間で共有される mutable state とみなす
- 同じ `pluginSlug` を使う複数 source のあいだで共有される，source 非依存の mutable state とする
- source ごとの観測進捗や入力設定，app 全体設定とは分け，異なる `pluginSlug` 間では共有しない
- 例:
  - service 共通 session metadata
  - plugin 内で共有する cookie jar
  - service 側応答に応じて更新される rate limit 情報
  - source 横断で共有したい一時的な service 側実行文脈

### 境界の原則

- plugin は plugin global runtime state を直接永続化しない
- plugin は，必要なときに host 経由で現在値を読み，必要なときに host へ新しい値を書き戻す
- host は，state の保存場所，versioning，基本的な競合検出，秘匿，寿命管理を責務として持つ
- SDK 公開契約では，state の shape は JSON serialize 可能な object を基本にしてよい
- plugin global runtime state の意味，property 名，互換性管理は plugin の責務とする
- plugin global runtime state は plugin 実行 capability であり，plugin 機能の通常 input に混ぜない
- host は，state の中身を解釈せず，opaque object として read/write する
- host は，少なくとも `load` と compare-and-swap 相当の `save` を提供し，更新競合は error または conflict として plugin へ返す
- host は，last-write-wins による黙った上書きを標準挙動にしない
- plugin は，host が返した競合結果に応じて再読込，merge，再試行の方針を決める
- host は，呼び出し中 plugin の `pluginSlug` に対応する state だけを expose し，別 `pluginSlug` の state へアクセスさせない

### access と整合性

- access scope は，同じ `pluginSlug` の実行間共有までに限定する
- `source-collector` 全体や，任意の複数 `pluginSlug` をまたぐ共有 access は初期スコープに含めない
- multi-key transaction や明示 lock を，初期 API の必須要件にはしない
- host が提供するのは，plugin が破損しにくくなる最低限の transactional protection までとする
- state schema の整合性や，複数 source からの更新をどう統合するかは plugin が決める

### secret との関係

- plugin global runtime state は，秘密情報そのものの標準保存先を定義するものではない
- secret 本体，secret 参照，secret から導出される session 状態は区別して扱う
- ただし，plugin 実行中に更新される session 由来の mutable state を host 管理下へ置きたい場合，その置き場として plugin global runtime state を使ってよい
- secret 本体をこの state へ必ず保存することは，core の標準方針にしない
- host 側の標準永続化実装に，暗号化保存を必須要件としては課さない
- plugin global runtime state に秘密情報相当を入れる場合，その保護方式，秘匿性の担保，漏洩時の影響評価は plugin の責務とする
- core は，plugin global runtime state を secret manager や秘密情報保管庫の代替として位置づけない

## 影響

- source ごとの観測進捗と，plugin 全体共有の実行文脈とを分離できる
- source collector plugin が，source と独立した共有 mutable state を必要とする場合でも，plugin 自身が独自永続化に逃げずに済む
- host object に capability を集約する方針と整合する
- 将来，plugin global runtime state の保存先を DB，file，secret manager 併用などへ差し替える余地を保てる
- 同時更新が起きても，host 側で silent overwrite を避けやすくなる
- 一方で，host 側には plugin global runtime state の保存 API と，競合や寿命をどう扱うかの設計が別途必要になる

## 代替案

- `collectorPluginState` を source 横断共有の state まで兼ねる
  - source ごとの観測進捗と plugin 全体共有 state の責務が混ざるため採らない
- `collector_setting.config` に plugin 全体共有 state を入れる
  - 人や API が与える入力設定と plugin 実行が更新する内部状態が混ざるため採らない
- `app_settings` に plugin ごとの mutable state を入れる
  - app 全体設定と plugin 実行時状態との責務境界が崩れるため採らない
- plugin ごとに任意の file や外部 store を自由に持たせる
  - host から見た再現性，運用性，移植性が落ちるため採らない
- plugin global runtime state を secret 本体の標準保存先として扱う
  - secret 管理と runtime state 管理は運用要件が異なるため主案にはしない

## 参考資料

- [ADR-0030] ADR-0030: 定期実行クローラの設定は source ごとの設定から分けて管理する
- [ADR-0035] ADR-0035: collector plugin 固有の継続状態は collector setting とは分けて backend が保持する
- [ADR-0060] ADR-0060: plugin 実行 capability は collector 固有 context ではなく host object として公開する

[ADR-0030]: ./0030-configuration-management.md
[ADR-0035]: ./0035-plugin-owned-state-storage.md
[ADR-0060]: ./0060-plugin-host-object.md
