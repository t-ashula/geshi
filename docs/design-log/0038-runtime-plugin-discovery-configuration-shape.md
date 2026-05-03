# ADR-0038: source collector plugin の発見元と利用可否制御の境界を runtime 設定と全体設定に分ける に対するメモ

## 何を決めたかったか

今回の論点は，source collector plugin の追加を `backend` source code の静的 import から外したいときに，次の 2 つをどこで持つかである．

- その process がどの plugin package を読みに行くか
- 読めた plugin のうち，`geshi` としてどれを利用対象にするか

見た目は近いが，前者は配布と起動の責務であり，後者はアプリケーションの運用ポリシーである．
この 2 つを同じ設定置き場に押し込むか，分けるかが ADR-0038 の判断材料だった．

## 先に整理したいこと

方式を決める前に，plugin 機構に対して何をしたいか，何をしたくないか，何ができるか，何ができないかを先に言語化したい．
方式比較はこの整理の上で行う方がぶれにくい．

## plugin 機構でやりたいこと

- `backend` 本体が特定 external plugin package を source code で直接知り続けないようにしたい
- built-in plugin と external plugin を，同じ plugin definition 契約で扱いたい
- source collector plugin の追加を，`backend` の業務ロジック改変ではなく，構成変更として扱いたい
- `backend` と worker が同じ plugin 集合を前提に動けるようにしたい
- plugin ごとに `available` / `unavailable` の状態を観測できるようにしたい
- frontend から，利用可能 plugin と利用不能 plugin の区別が分かるようにしたい
- app 全体設定で，「install 済み plugin のうちどれを使うか」を制御できるようにしたい
- plugin の追加や差し替えの際に，`pluginSlug` を論理識別子として安定的に扱いたい
- private plugin やローカル plugin のように，本体 repository と別都合の plugin も扱える余地を持ちたい

## plugin 機構でやりたくないこと

- external plugin を追加するたびに `backend/src/plugins/index.ts` へ静的 import を増やしたくない
- plugin package 名や import path を source ごとの設定や source 登録 API に漏らしたくない
- `app_settings` に deployment や package 配布の責務まで背負わせたくない
- 1 つの optional external plugin が壊れただけで app 全体を常に停止させたくない
- unavailable な plugin を完全に不可視化して，利用者や運用者が原因を追えなくしたくない
- private plugin や `file:` plugin の依存を，本体 repository の `package.json` / lockfile に常時混ぜたくない
- plugin install / uninstall / upgrade を，いまの段階で web UI から完結させる前提にはしたくない
- plugin の実行を sandbox や別 process に分離しているかのように見せたくない

## いまの plugin 機構で比較的できること

- Node.js の module resolution で解決できる package や file path を import する
- process 起動時に plugin を一括で読み込んで registry を構築する
- manifest や capability や API version を見て registry 登録可否を判定する
- built-in plugin と external plugin を同じ registry へ載せる
- plugin 一覧 API で plugin metadata や status を frontend へ返す
- `pluginSlug` を使って source や job が依存先 plugin を識別する
- optional external plugin の import failure を unavailable 扱いにして縮退運転する

## いまの plugin 機構でそのままはできないこと

- runtime 上に存在しない npm package を DB 設定だけで使えるようにする
- `backend` と worker で異なる plugin 集合のまま安全に同一 job 系を回す
- private plugin や `file:` plugin を，本体 repository の共有依存に無理なく混ぜる
- plugin install 後に再起動なしで全 process へ確実に反映する
- 任意 external plugin の導入を，安全性や整合性の検討なしに web UI から行う
- plugin 実装の不整合や `pluginSlug` 重複を無害なものとして握りつぶす

## この整理から見える境界

### 1. package discovery は source / app setting の責務ではない

「その process がどの module を import 対象として知っているか」は，source ごとの設定でも app policy でもなく，deployment / runtime の責務に見える．

### 2. activation policy は app setting の責務として自然

「発見できた plugin のうちどれを利用対象とするか」は，運用判断であり，全体設定として持つ方が自然に見える．

### 3. plugin status は runtime 観測結果として扱うのが自然

`available` / `unavailable` は設定値そのものというより，起動時の load 結果である．
そのため，まずは DB へ保存するより loader の結果として観測し，API へ反映する方が責務がきれいに見える．

## 現状から見える制約

### 1. plugin を使う process が複数ある

- `backend`
- `observe-source` worker
- `acquire-content` worker

これらは同じ `pluginSlug` を前提に協調する．
したがって，「ある process では import できるが，別 process では import できない」を無視して設計すると，source 作成時は見えていた plugin が job 実行時に消える．

### 2. `app_settings` は現在，配布情報を持つ場所ではない

- [ADR-0030] の方針では，全体設定は app の運用設定である
- 現在の実装でも `app_settings` / `app_setting_snapshots` は periodic crawl のような app policy を持つために使っている
- 一方で，`node_modules` に何が入っているか，どの module specifier を import できるかは deploy / runtime の事情である

ここに package 名や import path まで入れると，app policy と配布情報の責務が混ざる．

### 3. plugin 追加には「インストール」と「有効化」がある

外部 plugin を使うまでには，少なくとも次の段階がある．

1. package を install する
2. process からその package を import できるようにする
3. `geshi` としてその plugin を有効にする

この 3 つは同じ操作ではない．
特に 1 と 2 は deployment の責務であり，3 は application configuration の責務である．

### 4. `geshi` 本体の依存と運用環境固有 plugin の依存は一致しない

- `geshi` 本体 repository は，開発者全員や CI が共有する依存集合を持つ
- 一方で，実運用では private repository 由来 plugin や `file:` 参照 plugin のように，特定環境でしか使わない plugin を追加したい場合がある
- そのような plugin を `geshi` 本体の `package.json` や lockfile に直接混ぜると，repository に push できない依存や，共有したくない依存が本体開発フローへ混入する
- つまり，「plugin は npm package である」と「plugin は本体 package.json に載る」は同義ではない
- Ruby Bundler の `Gemfile.local` のように，本体依存へ local / private 依存を自然に重ねる標準仕組みが npm 側には薄い
- そのため，本体依存と site 固有 plugin 依存の分離は，`geshi` 側の構成や運用ルールとして自前で用意する前提になりやすい

この問題は，plugin discovery を考えるときに無視しづらい．
外部 plugin を npm package として扱うとしても，その依存宣言の置き場を `geshi` 本体 repository に固定する設計は避けたい．

## 検討した案

## 案 A: package 名も有効化設定も全部 `app_settings` に入れる

例:

```json
{
  "plugins": [
    {
      "module": "@geshi/plugin-go-jp-rss",
      "enabled": true
    }
  ]
}
```

### 良い点

- 「何を使うか」が 1 箇所にまとまる
- UI や API から全部変更できそうに見える

### 問題

- DB に module 名が書かれていても，その package が runtime に存在する保証はない
- `backend` だけでなく worker も同じ package 群を import できないと成立しない
- deploy 済み artifact の中身を，DB 設定が後追いで変えられる形になる
- import 失敗時に，「設定ミス」なのか「未インストール」なのか「worker 側だけ不足」なのかが曖昧になる
- [ADR-0030] の「全体設定は source ごとの設定から分ける」とは整合するが，「全体設定が deployment 事情まで持つ」ことまでは意図していない

### いったんの評価

一見簡単だが，DB が package 配布の真実を持つように振る舞ってしまう．
設定と配布の責務境界が崩れるので採りにくい．

## 案 B: 全部 runtime 設定に寄せる

例:

- `GESHI_SOURCE_COLLECTOR_PLUGIN_MODULES`
- `GESHI_ENABLED_SOURCE_COLLECTOR_PLUGINS`

のような環境変数だけで発見と有効化の両方を決める．

### 良い点

- process ごとに同じ設定ファイルや env を配れば，`backend` と worker の整合を取りやすい
- import 可否の責務を runtime 側に閉じ込められる

### 問題

- app としての利用ポリシー変更まで deploy 手順に引っ張られる
- 「この plugin は install 済みだが今は使わない」のような運用判断を DB snapshot に残せない
- 既に `app_settings` で管理している periodic crawl と違い，app policy が runtime へ散る
- frontend や API から見た「利用可能 plugin policy」の一貫した参照元が弱くなる

### いったんの評価

配布責務には合うが，app policy まで env に寄せるのは粗い．
`geshi` 全体設定を別に持つ流れとも相性が悪い．

## 案 C: 発見は運用時設定，有効化は全体設定に分ける

例:

- 運用時設定
  - `geshi.config.js` のような config module に plugin module specifier や path を列挙する
- 全体設定
  - `enabledPluginSlugs: ["go-jp-rss"]`

### 良い点

- import 可能性は runtime が責任を持つ
- app として使うかどうかは `app_settings` で制御できる
- `pluginSlug` を論理識別子にできるので，package 名と利用者向け識別子を分けられる
- built-in plugin と external plugin を同じ registry に載せつつ，運用上の ON/OFF だけ全体設定で持てる
- `geshi.config.js` のような site 設定に寄せれば，本体 repository の `package.json` に private plugin や `file:` plugin を直接混ぜずに済む
- 設定不整合を分けて扱える
  - package が無い
  - package はあるが有効化していない
  - 有効化設定が未知 `pluginSlug` を参照している

### 問題

- 設定が 2 箇所になる
- loader と app policy の両方を考える必要があり，実装の入口は少し増える
- `app_settings` にどう保存するかは別途決める必要がある
- `geshi.config.js` のような config module を採る場合は，その parse / validation と，再起動前提の運用ルールを決める必要がある

### いったんの評価

責務分担として最も素直だった．
「package を import できるか」と「geshi として使うか」を分けられるので，縮退運転や API 表示ともつなげやすい．

## 本体 `package.json` に plugin 依存を混ぜる案を避けたい理由

external plugin を npm package として扱うとしても，それを常に `geshi` 本体 repository の `package.json` に追加する前提は避けたい．

### 問題になるケース

- private repository 上の plugin を一部環境でだけ使いたい
- `file:` 参照のローカル plugin を実験的に使いたい
- OSS として共有したい本体 repository に，配布できない依存を混ぜたくない
- CI や他開発者にとって不要な plugin 依存を常時 install させたくない

### このとき起きること

- `package.json` / lockfile が運用環境固有事情を背負う
- 本体開発フローと運用フローの責務が混ざる
- `git push` できる依存集合と，本番ノードでだけ存在する依存集合の差を repository が吸収できなくなる

### ここから得た示唆

- plugin 実体の配置は npm package でもよい
- ただし，その依存宣言の主体は `geshi` 本体 repository と切り離せる方がよい
- npm 側にちょうどよい overlay 機構が無い以上，その切り離し方は `geshi` 側で設計する必要がある
- そのため，plugin discovery は「本体 package.json を見る」ではなく，「運用時設定を読む」と考える方が柔軟である

## `geshi.config.js` 案をどう見たか

`geshi.config.js` のような config module に load 対象 plugin を書く案は有力である．

### 良い点

- `npm i` と process 再起動を前提にした plugin 追加の流れと自然に合う
- `backend` と worker が同じ config module を読めば，plugin discovery の整合を取りやすい
- site 固有 plugin 構成を，本体 source code や本体 DB から切り離して持ちやすい

### 気になった点

- `app_settings` とどこで責務を分けるかを明確にしないと，config module 側に enable/disable まで書きたくなる
- config 変更をいつ反映するかは，再起動前提で割り切る方が自然だが，その運用ルールを明示する必要がある
- JS module なので，単なる JSON より自由度が高く，runtime validation を用意しないと壊れやすい

### 現時点の捉え方

- `geshi.config.js` は運用時設定の有力な具体案である
- ただし ADR-0038 では，config 媒体そのものを固定しなくてもよい
- 固定したい本質は，「package discovery は DB ではなく process 起動時に読む運用時設定が担う」という責務境界である

## generate 方式はどうか

`Prisma generate` のように，運用時設定を入力として，実行時に使う plugin registry module を事前生成する方式も有力に見えた．

### 発想

- `geshi.config.js` のような運用時設定に plugin entry specifier 一覧を書く
- `geshi` の generate command がその設定を読む
- generate 時に plugin entry を import / validate する
- 生成物として plugin registry module や plugin metadata module を出力する
- `backend` と worker はその生成済み module だけを静的 import する

### 良い点

- `backend` や worker の runtime では，毎回 config parse や plugin discovery をやらなくてよい
- process 間で同じ生成物を読むため，plugin 集合の整合を取りやすい
- private plugin や `file:` plugin も，generate を走らせる site 環境で解決できればよい
- import failure，契約違反，`pluginSlug` 重複のような問題を，起動時より前に generate 失敗として検出しやすい
- runtime 側の責務を「生成済み registry を使う」に絞りやすい
- `geshi.config.js` を「実行時設定」というより「生成入力」として扱える

### 気になる点

- generate をいつ実行するかの運用ルールが必要
- 生成物を repository に commit するか，deploy artifact にだけ含めるかを決める必要がある
- plugin 追加時は，config 更新，依存解決，generate，再起動の手順が必要になる
- unavailable plugin を runtime で観測するより，generate 時点で弾く寄りになるので，縮退運転の考え方を少し見直す必要がある
- plugin 一覧 API に返す status を，generate 結果からどう表現するかを決める必要がある

### 現時点の捉え方

- runtime dynamic import 一辺倒より，責務分離と process 整合の面でかなり有力
- 特に，本体 repository と site 固有 plugin 構成を分けたい事情と相性がよい
- 一方で，`available` / `unavailable` の runtime status をどう扱うかは，ADR-0039 の論点と合わせて見直しが必要
- そのため，現時点では「有力候補として保持し，ADR-0038 の結論を急いで固定しすぎない」がよさそうに見える

## いま有力に見えている実装の骨格

ここまでの議論から，次の流れが有力に見えている．

1. `geshi.config.js` や `geshi.plugins.json` のような運用時設定を持つ
2. その設定には，plugin 用 `dependencies` 相当の package 名と version，または `file:` / path を書く
3. 独立した plugin CLI が，その設定を読んで plugin 専用 package root へ install する
4. 別の generate 処理が，install 済み plugin から registry entry module を生成する
5. `backend` と worker は，生成済み固定 module だけを import する
6. 実行時は，それらを通常の plugin registry として扱う

この骨格だと，本体 repository の依存と site 固有 plugin 依存を分けやすく，runtime discovery の責務も薄くしやすい．

## ここから分けて決めたい論点

この骨格を 1 本の ADR で全部決めると重いので，少なくとも次の 3 つに分けて考えた方がよい．

### 1. 運用時設定としての plugin 設定の形式

- `geshi.config.js` にするか
- `geshi.plugins.json` にするか
- `dependencies` 風の schema をどう持つか
- package 名，version，git URL，`file:` をどう表現するか

### 2. plugin CLI の責務

- install と generate を分けるか
- install を明示コマンドにするか
- generate を自動実行可能にするか
- install 先の専用 package root をどう扱うか

### 3. `backend` / worker の import 入口

- 各 plugin package を runtime で都度 import するか
- 生成済み固定 module を静的 import するか
- 固定 module の置き場所や export shape をどうするか

## 設定形式について今見えていること

- 独自 plugin registry を持ちたくない
- `latest` 固定は不便
- private package, git URL, `file:` を扱いたい

この条件だと，plugin 設定は独自 schemaよりも `package.json` の `dependencies` に近い形を流用する方が自然に見える．
これは npm の既存表現力をそのまま使えるからである．

一方で，その依存宣言を `geshi` 本体 repository の `package.json` へ直接混ぜるのは避けたいので，運用時設定として独立させる必要がある．

## install と generate の責務分離について今見えていること

- install は外部 network, registry, 認証, private repository などの外部要因に失敗が引っ張られる
- generate は，手元に install 済みのものがある前提なら，比較的閉じた処理として扱える

そのため，

- install は明示コマンド
- generate は明示でも自動でもよい

という分け方が自然に見える．

`backend` 起動時に generate を自動実行できる余地は残してよいが，install まで自動実行するのは外部失敗要因が多すぎて避けたい．

## install 先について今見えていること

plugin 用依存を本体の `node_modules` にそのまま混ぜると，本体依存と plugin 依存の衝突や責務混在が起きやすい．

したがって，plugin 用の専用 package root を別に持ち，その配下で `node_modules` 解決可能にする方が扱いやすそうに見える．

重要なのは「Node package として import 可能であること」であり，本体 repository の `node_modules` に直置きすること自体には強い価値がない．

## `app_settings` にどう持たせるかの検討

案 C を採るとしても，全体設定をどの shape で持つかには余地がある．

## 1. `enabledPluginSlugs` のような単純配列

例:

```json
{
  "enabledPluginSlugs": ["podcast-rss", "go-jp-rss"]
}
```

### 良い点

- 意味が明確
- 有効 / 無効だけを決める段階では十分
- frontend の一覧制御にもそのまま使いやすい

### 弱い点

- plugin ごとの message override や優先順位のような policy を後で足したくなると窮屈

## 2. plugin ごとの policy object

例:

```json
{
  "plugins": {
    "podcast-rss": { "enabled": true },
    "go-jp-rss": { "enabled": false }
  }
}
```

### 良い点

- 将来の拡張余地がある

### 弱い点

- 今の段階では過剰
- `available / unavailable` の runtime 状態まで混ぜ込み始めると責務が再び曖昧になる

## 3. 明示カラムで持つか，JSON で持つか

現行の `app_setting_snapshots` は periodic crawl 用の明示カラムを持っている．

### 明示カラムの利点

- 型と migration が見えやすい
- 何を全体設定として正式に持つかが DB schema に表れる

### 明示カラムの弱点

- plugin slug 配列のような可変長値とは相性が悪い
- 中間 table を増やすか，別 schema を切る検討が必要になる

### JSON の利点

- `enabledPluginSlugs` のような可変長構造を素直に持てる

### JSON の弱点

- 既存 `app_setting_snapshots` の「明示カラムで持つ」流れからは少し外れる
- 何を正式な設定項目とみなすかが schema 上で弱くなる

ここは ADR-0038 本体で断定しすぎず，実装直前に migration 設計としてもう一段詰めてもよいと考えた．

## 失敗モードをどう考えたか

最初は，runtime 設定に書かれた package が import できないなら起動失敗でもよいかと考えた．
ただし，external plugin は optional extension として扱えるので，それだけで app 全体を止めるのは強すぎる．

そのため，整理は次のようになった．

- built-in plugin の読込失敗
  - app 自体の前提崩壊なので起動失敗
- external plugin の import 失敗
  - unavailable として縮退運転
- 契約違反や `pluginSlug` 重複
  - registry 構築不能なので起動失敗
- 全体設定が未知 `pluginSlug` を参照
  - app policy の不整合として明示エラー

この分け方だと，発見責務と利用ポリシー責務の違いが失敗モードにも表れる．

## ここまでの考えのまとめ

- package discovery は deployment / runtime の責務として扱う方が自然
- 本体 `package.json` に external plugin 依存を混ぜる前提は，開発と運用の責務を衝突させやすい
- enabled / disabled は app policy として `app_settings` に寄せる方が自然
- `pluginSlug` は package 名と分けて論理識別子として扱う方が安全
- 全体設定の DB 表現は，まずは単純な enabled list を起点に考えるのが過不足ない
- runtime 状態そのものを DB に保存するより，loader の結果として都度観測する方が責務がきれい
- ただし，plugin discovery を runtime で毎回やる必要があるかは別で，generate 方式に寄せると実行時責務を軽くできる可能性がある
- 具体実装は，「運用時設定」「plugin CLI」「生成済み import 入口」の 3 つに分けて ADR を起票した方が議論しやすい

## ADR に持ち込んだ最小結論

Design log としては案 C が最有力だったが，ADR-0038 では次だけを固定対象に絞るのがよいと考えた．

- plugin package の発見元は runtime 設定
- plugin の利用可否 policy は全体設定
- 両者の識別境界は `pluginSlug`

`app_settings` の具体的 schema shape や API 更新方法は，この結論の上に実装判断として積む余地を残す．

## 実装メモとして残しておきたいこと

- 運用時設定には，外部 plugin 用依存宣言を持つ項目を追加する
- 全体設定には，許可された `pluginSlug` 一覧を持つ項目を追加してよい
- plugin 一覧 API は，registry 全件ではなく「生成済みかつ全体設定で有効な plugin」を返す形へ拡張してよい
- test では，site 設定，install / generate，app 設定との整合，worker 起動配線の層で確認する

## 0040 から 0042 で持たせたい具体案

### 0040: 運用時設定の具体案

- 設定ファイル名は `geshi.plugins.json`
- config 媒体は JSON
- schema は top-level に `dependencies` を持つ最小形
- plugin 用依存宣言と app policy は分離する

例:

```json
{
  "dependencies": {
    "@geshi/plugin-go-jp-rss": "^0.1.0",
    "@private/geshi-plugin-foo": "git+ssh://git@example.com/private/foo.git",
    "geshi-plugin-local-bar": "file:../plugins/bar"
  }
}
```

この案は npm の語彙に寄りすぎており，`geshi` の plugin 設定としては少し意味がずれる感触がある．
そのため，現時点では次のような shape も有力に見えている．

```ts
export default {
  plugin: {
    output: ".geshi/generated/plugins/",
    packages: {
      "@geshi/plugin-go-jp-rss": "^0.1.0",
      "@private/geshi-plugin-foo": "git+ssh://git@example.com/private/foo.git",
      "geshi-plugin-local-bar": "file:../plugins/bar",
    } satisfies Record<string, PluginPackageSpecString>,
  },
};
```

この shape の利点は次の通りである．

- `dependencies` よりも「plugin 機構のための package 群」という意味が素直
- `plugin` 配下に，将来別の plugin 機構設定を追加しやすい
- `output` を plugin 用 root directory として持てば，その配下へ `package.json`, `node_modules`, `index.js`, `metadata.json` を固定配置できる
- package 名と spec string の組であることが明確

一方で，`PluginPackageSpecString` を runtime 上どう validation するか，型としてどこまで明示するかは未決である．

また，この設定が扱うのは external plugin package だけに留める方が自然に見える．

- built-in plugin は `geshi` 本体同梱のものとして別扱いにする
- built-in plugin の有効 / 無効は，必要なら app settings 側で制御する
- したがって，運用時設定の `plugin.packages` は built-in plugin の列挙や切り替えを責務に含めない

### 0041: CLI の具体案

- CLI の入口は `geshi`
- command は `geshi plugins install` と `geshi plugins generate`
- plugin 専用 package root は `./.geshi/plugins/installed/`
- この配下に plugin 用 `package.json` と `node_modules` を持つ
- `geshi.plugins.json` の `dependencies` は，この package root へ反映する
- 生成物は `./.geshi/generated/plugins/index.js` と `./.geshi/generated/plugins/metadata.json`

install 周りは独自 package manager 的に作らず，npm の依存解決と配置の仕組みをそのまま使う方針が有力である．

- install 用の `package.json` を固定位置に生成または同期する
- 依存解決そのものは npm へ委ねる
- private registry, git URL, `file:` も npm が扱える範囲に乗せる

この方針なら，`geshi` 側は「何を install 入力にするか」と「どこへ install させるか」に責務を絞りやすい．

### 0042: import 境界の具体案

- import 入口は `./.geshi/generated/plugins/index.js`
- built-in plugin definitions は `backend` 側 code 同梱のまま保持してよい
- registry 構築時に，built-in plugin definitions と生成済み external plugin definitions を束ねる
- generated module は external plugin definitions と plugin metadata の再エクスポートを持ってよい

## 参考資料

- [ADR-0030] ADR-0030: geshi 全体にかかる設定は source ごとの設定から分けて管理する
- [ADR-0038] ADR-0038: source collector plugin の発見元と利用可否制御の境界を runtime 設定と全体設定に分ける

[ADR-0030]: ../decisions/0030-configuration-management.md
[ADR-0038]: ../decisions/0038-runtime-plugin-discovery-and-activation.md
