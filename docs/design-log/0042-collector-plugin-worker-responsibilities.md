# 0042 collector plugin worker responsibilities

## 位置づけ

この文書は，`ADR-0042` の検討メモ置き場である．

## 決まったこと

- collector plugin は，collector ごとの観察 (`observe`) と取得 (`acquire`) の worker 実装を提供する
- `observeChannel` job は当面 collector plugin の `observe()` を呼ぶ
- `acquireEntry` job は当面 collector plugin の `acquire()` を呼ぶ
- collector plugin との I/O 契約は versioned にする
- backend の plugin 向け read-only API は，その version に対応した plugin 向け `channel` / `collector` / `entry` を返す
- plugin 向け read-only API の返却 model は，plugin に見せる値を必要最小限に絞る前提にする
- たとえば `observe()` は `Entry[]` を返すので，`Entry` に必要で plugin 側では生成できない値を `getChannel` / `getCollector` などの read-only API から取得できる必要がある
- plugin 側 worker の入口は，基本的に `channelId` / `collectorId` / `entryId` などの id ベースにする
- `observeChannel` job の入口は当面 `channelId` のみとする
- `acquireEntry` job の入口は当面 `entryId` のみとする
- plugin 側 worker は，自身が使う contract version を自己申告して backend の plugin 向け read-only API から必要な model を取得する
- contract version の対応可否は backend 側が個別に判断する
  - plugin が request につけた version に backend が対応可能なら，その version で応答する
  - backend が対応不可能なら，version 不一致エラーで応答する
- contract version は plugin が backend API を呼ぶ時に，引数解釈と戻り値型として保証してほしい version を自己申告するためのものであり，DB には持たない
- collector plugin の最小 interface は，少なくとも `name()` / `info()` / `observe()` / `acquire()` / `abilities()` を持つ
- `info()` の戻り値は，当面 `{ name }` のみとする
- `name()` は `info().name` の shortcut として扱う
- plugin は `abilities(version)` で，指定された contract version 向けの能力一覧を自己申告する
- backend は plugin scan 時に `abilities(version)` を呼び，利用時や選択時の絞り込みに使えるようにする
- backend は単一の contract version で動作し，plugin scan 時にはその version を使って `abilities(version)` を呼ぶ
- 当面の `AbilityName` は plugin 単位で `collector` のみとする
- ability 一覧の自己申告は，当面 `name` だけに留める
- backend は collector plugin の一覧を事前に把握している前提にする
- backend store (DB) には，collector plugin 名の一覧を保持するためのテーブルが必要である
- plugin 実体の解決層を backend 側に置く
- backend store (DB) には，plugin 実体の解決層のためのテーブルを追加する
- plugin 実体解決テーブルは，少なくとも `name` / `ability` / `path` の組を一意に扱うイメージとする
- plugin 実体解決テーブルの最小 schema は `name` / `ability` / `path` / `isBuiltin` とする
- plugin 実体解決テーブルの unique 制約は `name` / `ability` / `path` の 3 つ組とする
- それ以外の metadata は後回しにする
- 外部 plugin は，backend への明示的な install を必要とする
- backend 起動時に，解決層が plugin 実体候補を見つけて dynamic import し，plugin として応答できるものを collector plugin 一覧へ upsert する
- plugin load / upsert に関する security model は必要だが，現時点では後回しにする

## 0032 で決まっている前提

- Geshi 側の collector workflow では，少なくとも次の 3 種類の job を組み合わせる
  - `scheduleObserve`
  - `observeChannel`
  - `acquireEntry`
- `scheduleObserve` は Geshi 本体側の job である
- `observeChannel` は collector plugin 側の job である
- `acquireEntry` は collector plugin 側の job である
- `observeChannel` は，対象の `Channel` と `Collector` を入力として観察し，`Entry[]` を結果として返す
- `acquireEntry` は，対象の `Entry` と `Collector` を入力として取得し，`Entry` と `Asset[]` を結果として返す
- collector plugin 側の runtime worker は，backend の read-only API だけを利用してよい
- collector plugin 側の runtime worker は，`AssetStore` への read / write を行ってよい
- collector plugin 側の job は，Geshi 側 model を直接更新しない
- Geshi 側 model の更新は `import job` が backend の write API を呼んで行う

## 決まっていないこと

- backend 起動時の plugin 実体探索対象 path をどう決めるか
- 外部 plugin の install をどう表現するか
