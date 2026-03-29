# 0032 collector plugin responsibilities

## 位置づけ

この文書は，`ADR-0032` の検討メモ置き場である．

## API 方針を踏まえた見直し

[ADR-0010](../decisions/0010-backend-api-policy.md) と [ADR-0012](../decisions/0012-backend-job-execution-policy.md) を踏まえると，

- backend API は Geshi における操作の共通入口である
- job は domain データそのものではなく，実行履歴と制御対象である
- 成果物や `Entry` のような domain データ更新は backend 側へ反映する

という前提で collector workflow を整理する必要がある．

この前提に立つと，当面の権限境界は次のように置くのがよい．

- runtime worker
  - backend の read-only API は呼んでよい
  - write 系 API は呼ばない
- `import job`
  - write 系 API を呼んで domain データを更新してよい
- frontend
  - write 系 API を呼んでよい

したがって，collector plugin の議論では

- runtime worker が何の read-only API を必要とするか
- `import job` が何の write API を必要とするか

を先に整理する必要がある．

## 0032 で決めるべきこと

`0032` では，collector plugin の責務として，少なくとも次を決める必要がある．

1. 投入ジョブの名称
2. 観察ジョブの名称
3. 取得ジョブの名称
4. それぞれの責務
5. それぞれのインタフェース
6. `Collector` モデルに入れる `config` が何を表すのか
7. `Channel` に持たせる情報と `Collector` に持たせる設定の境界

## 論点の整理順

### 1. 投入ジョブと観察ジョブと取得ジョブの名称

まず，Geshi 側の collector workflow に関わる 3 種類の job に対して，何と呼ぶかを決める必要がある．

ここで決めたいのは，

- 観察対象を拾って観察ジョブを登録する job
- 個別対象を見つける job
- 個別対象から利用対象データを取得する job

を，Geshi 側の workflow と collector plugin の契約の中で何という名前で扱うかである．

現時点では，投入ジョブは `scheduleObserve` と呼ぶのがよさそうである．

- 投入ジョブ: `scheduleObserve`

現時点では，この 2 つの名前はそのまま次でよい．

- 観察ジョブ: `observeChannel`
- 取得ジョブ: `acquireEntry`

このとき，

- `scheduleObserve` は Geshi 本体側の job
- `observeChannel` と `acquireEntry` は collector plugin 側の job

として区別する必要がある．

### 2. 各ジョブの責務

名称が決まったら，次にそれぞれの job が何をどこまで担うかを決める必要がある．

少なくとも次を切り分ける必要がある．

- 外部 system や plugin 実行だけを担うのか
- `Entry` や `Asset` のような Geshi 側 model 更新まで担うのか
- 実行結果として何を返すのか

現時点では，collector plugin 側の job は，Geshi 側 model を直接更新しない前提にするのがよい．

つまり，3 つの job の責務は次のように置く．

- `scheduleObserve`
  - backend の API を通じて，観察対象となる `Channel` / `Collector` を拾う
  - 固定周期にもとづいて `observeChannel` を登録する
  - 自分では観察処理をしない
- `observeChannel`
  - 対象の `Channel` と `Collector` の設定を入力として，外部 system を観察する
  - collector が扱う識別子や backend の read-only API を使って，新規候補かどうかを事前判定してよい
  - `Entry` 一覧を結果として返す
  - `Entry` の作成や取得ジョブの登録そのものは，直接行わない
- `acquireEntry`
  - 対象の `Entry` と `Collector` の設定を入力として，利用対象データの取得を行う
  - 取得結果を返す
  - `Asset` や `Entry` の更新そのものは，直接行わない

この整理にすると，collector plugin 側の job は

- 外部 system を触る
- plugin を実行する
- 結果を返す

までに責務を限定できる．

一方で，Geshi 側 model の更新は後段の import 処理で行う前提になる．

ここでは，`scheduleObserve` が細かい投入判定を持つ案と，単純な周期投入だけを担う案とを比べたが，現時点では後者を採るのがよい．

つまり，

- `scheduleObserve` は，たとえば「1 時間に 1 回」のような固定周期で `observeChannel` を投入する
- 実際に観察しに行くか，何もせず終了するかの判断は `observeChannel` が行う

という整理である．

この整理にすると，

- 無駄な `observeChannel` job は増える
- しかし，観察の実行条件に関する情報と判断は `observeChannel` 側だけで閉じる
- `scheduleObserve` は単純な周期投入に責務を限定できる
- runtime worker が DB コネクションを直接持たずに済む

当面は，全 plugin で「1 時間に 1 回」のような共通の周期設定を Geshi 側で持てればよい．

一方で，将来は plugin 側で投入タイミング計算を変えられる余地を残したい．

そのため，周期そのものに加えて，少なくとも次のような「観察周期の決め方」を持てるようにするのがよい．

- `interval`
- `manual`

このとき，

- `interval` は Geshi 側が固定周期で `observeChannel` を投入する
- `manual` は Geshi 側が自動投入しない

という意味で扱うことを想定する．

### 3. 各ジョブのインタフェース

責務が決まったら，入力と出力を決める必要がある．

ここで決めたいのは，

- 観察ジョブの input
- 観察ジョブの output
- 取得ジョブの input
- 取得ジョブの output

である．

現時点の見立てとしては，少なくとも次の形が自然である．

- `scheduleObserve`
  - input: `channelIds?: ChannelId[]`
  - backend の read-only API を使って対象 `Channel` / `Collector` を列挙する
  - 指定があれば，その `Channel` 群だけを対象に列挙する
- `observeChannel`
  - input: `channelId: ChannelId`
  - 追加で，観察条件を無視して実行するための `force: boolean` を持てるようにする
  - output: `entries: Entry[]`
- `acquireEntry`
  - input: `entryId: EntryId`
  - output: `entry: Entry`, `assets: Asset[]`

この `force` は，手動実行や再試行時に，通常の観察実行条件を飛ばして観察しに行くためのフラグとして扱う．

`acquireEntry` の戻り値は，当面

- `entry: Entry`
- `assets: Asset[]`

でよい．

ただし，実ファイルや大きい本文のような実データそのものは `AssetStore` 側で扱う前提にする．

したがって，

- `acquireEntry` worker は `AssetStore` への read / write を行ってよい
- backend の write API には，`AssetStore` へ保存した結果を反映した `entry` と `assets` を渡す

という整理にする．

ここでの整理としては，`observeChannel` の戻り値の本体は `Entry[]` である．

このとき `observeChannel` は，単に外部側の一覧をなぞるだけでは足りず，

- collector が持つ `uniqueId`
- backend の read-only API から取得できる既存 `Entry`

などを使って，新規候補かどうかを事前判定してよい．

ただし，新規性の最終判定は backend の write API 側でも行う必要がある．

つまり，

- `observeChannel` 側では，戻り値が数百件単位に膨らむことを避けるため，`uniqueId` などを使って事前に絞り込んでよい
- backend 側では，write 時に `uniqueId` を用いて，新規作成か既存更新かを最終判定する

という二段構えにするのがよい．

一方で，その結果を `import job` がどう受け取り，どの write API をどう呼ぶかという「import への指示」の形は，collector plugin のインタフェースというより `job model` と bridge の問題である．

したがって，

- `0032` では `observeChannel` の本体結果を `Entry[]` とするところまで扱う
- `import job` への指示方法は `0033` で扱う

として切り分ける．

ここで重要なのは，`scheduleObserve` の runtime worker は DB へ直接アクセスしない一方で，backend の read-only API にはアクセスしてよい前提にすることである．

## backend に必要な API

現時点では，collector workflow のために少なくとも次の backend API が必要になる．

### runtime worker が使う read-only API

- `scheduleObserve`
  - `/channels` で観察対象の `Channel` 一覧を取得する
  - 必要なら `channelIds` や観察周期種別で絞り込めるようにする
  - `Collector` は `/collectors` から取得するか，`/channels` の表現に含めて取得できればよい

- `observeChannel`
  - `/channels/:id` で対象の `Channel` を取得する
  - 必要な `Collector` は `/collectors/:id` で取得する

- `acquireEntry`
  - `/entries/:id` で対象の `Entry` を取得する
  - 必要な `Channel` / `Collector` は `/channels/:id` と `/collectors/:id` で取得する

### `import job` が使う write API

#### `observeChannel` の結果反映

- `registerObservedEntries`
  - `observeChannel` の結果から `Entry` を作成または更新する
  - 必要なら取得予定時刻つきの `acquireEntry` job を登録する
  - params
    - `channelId: ChannelId`
    - `entries: ObservedEntryInput[]`
  - response
    - `createdEntryIds: EntryId[]`
    - `scheduledAcquireJobIds: JobId[]`

#### `acquireEntry` の結果反映

- `registerAcquiredEntry`
  - `acquireEntry` の結果から `Entry` / `Asset` を更新する
  - params
    - `entryId: EntryId`
    - `entry: AcquiredEntryInput`
    - `assets: AcquiredAssetInput[]`
  - response
    - `entryId: EntryId`
    - `assetIds: AssetId[]`

ここでの API 名は仮であり，正式名は後続で詰める．

### write API のパラメータ

現時点では，書き込みのためだけの，モデルと無関係な専用型は原則として作らない．

write API の payload は，基本的に `Entry` / `Asset` モデルそのものか，その部分型として扱えばよい．

- `ObservedEntryInput`
  - 基本的には `Omit<Entry, "id" | "slug" | "channel" | "status">` 相当でよい
  - 追加で `acquireAt?: string` のような取得予約情報を持てるようにする
- `AcquiredEntryInput`
  - 基本的には `Partial<Entry>` 相当でよい
  - 少なくとも取得結果反映に必要な `status` を含められるようにする
- `AcquiredAssetInput`
  - 基本的には `Omit<Asset, "id" | "slug" | "entry">` 相当でよい
  - file body や text body のように `Asset` モデルだけでは足りない項目が必要なら追加する

### 4. `Collector.config` に入るもの

job の input が決まると，`Collector.config` に何を置くべきかが見える．

ここで決めたいのは，

- plugin に渡す固定設定
- plugin 実装が自由に決めてよい設定
- Geshi 本体が意味を知るべき設定

の境界である．

特に `scheduleObserve` の周期投入設定を，

- `Channel` に置くのか
- `Collector` に置くのか
- `Collector.config` の中で plugin ごとの設定として持つのか

は，この段で決める必要がある．

現時点の見立てとしては，少なくとも次のような設定は Geshi 側が意味を知る方がよい．

- 観察周期
- 観察周期の決め方

一方で，RSS の feed URL のように，実質的には収集設定だが API からは `Channel` の値として見えていてほしいものもある．

この場合は，

- 物理的な保持は `Collector` 側の値とする
- ただし API 表現では `Channel` の値として見えていてよい

と整理すればよい．

### 5. `Channel` と `Collector` の境界

最後に，`Channel` に何を残し，`Collector` に何を持たせるかを決める必要がある．

ここで決めたいのは，

- `Channel` が管理対象として持つべき情報
- `Collector` が収集実行設定として持つべき情報
- `Channel` に設定を持たせないことで困るものがあるか

現時点で追加で見えている論点は，`scheduleObserve` の投入タイミング判定に必要な情報をどちらへ置くかである．

である．
