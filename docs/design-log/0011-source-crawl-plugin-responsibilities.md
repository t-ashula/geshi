# Design Log 0011

`ADR-0011` の補足メモ．

## この段階の狙い

- `podcast rss source` 登録後に初回クロールを実行し，しばらく待つと `content` 一覧が見える最小経路を成立させる
- plugin 境界を，実装開始できる粒度まで具体化する
- `asset / storage` を完全に実装し切る前でも，後で破綻しない責務分離を先に固める

## plugin 境界で先に固定すること

- plugin は `source` または `crawl type` に対応する収集ロジックの単位とする
- plugin には少なくとも 2 系統の処理がある
  - `observe`
    - RSS を取得して `content` 候補一覧を作る
  - `acquire`
    - `content` 情報をもとに実ファイルを取得する
- plugin は backend の domain model を直接更新しない
- plugin は queue や HTTP の実装詳細を知らない
- plugin の入出力は，呼び出し層が定める型に閉じる

## observe の入力

`observe` は少なくとも次を受け取る想定にする．

- `rssUrl`
- 一時作業用の物理ディレクトリパス
  - 例: `/tmp/geshi/<job-id>/`
- plugin 向け実行文脈
  - logger
  - timeout / abort signal 相当
- 将来的な plugin 固有 option

この段階では plugin が `storage` 抽象そのものを受け取る形にはしない．

worker と plugin で，知るべき情報を分ける．

- worker は backend API を触ってよい
- worker は enqueue 時点の `source + collectorSettingSnapshot` 相当の情報を payload として受け取ってよい
- plugin は backend の model や API を知らず，少なくとも `rssUrl` があれば動くようにする
- `rssUrl` 自体は永続 model の専用列ではなく，worker が `source.url` と `collectorSettingSnapshot.config` から組み立てて渡せればよい

この段階の `observe` job payload は，join 済みの 1 object として，少なくとも次を持つ想定にする．

- `sourceId`
- `collectorSettingId`
- `collectorSettingSnapshotId`
- `slug`
- `kind`
- `url`
- `pluginSlug`
- `version`

### 理由

- plugin が `S3` のような高レイテンシ storage を直接細かく触ると，コストと待ち時間が増えやすい
- plugin はまずローカル I/O に閉じて作業し，完成物だけを後段で永続 storage へ移す方が単純である
- plugin ごとの差分は収集・抽出に集中させたい
- `collectorSettingSnapshot` を enqueue 時点で payload に含めれば，worker は 1. enqueue 時点の情報で駆動できる 2. backend API access を 1 hop 減らせる
- `rssUrl` 専用列を持たずとも，`source.url` を payload に含めれば `podcast-rss` の observe は成立する

## observe の出力

`observe` は少なくとも次を返す想定にする．

- `content` 候補一覧
  - `content` を構成するのに必要な情報
    - `id` を除く
    - 例: source との対応付けに使う外部識別子または URL, kind, publishedAt 相当, status 相当
  - `content snapshot` を構成するのに必要な情報
    - `version` を除く
    - 例: title, summary / description 相当, recordedAt 相当
- 一時ディスクへ書き出した成果物一覧
  - path
  - kind
  - mimeType
  - sourceUrl
  - 追加 metadata
- plugin 実行中に得られた補助情報
  - feed title
  - feed description
  - raw fetch 時刻など

## acquire の入力

`acquire` は少なくとも次を受け取る想定にする．

- 対象 `content`
- 取得元 URL や外部識別子
- 一時作業用の物理ディレクトリパス
- 実行文脈

## acquire の出力

`acquire` は少なくとも次を返す想定にする．

- 一時ディスクへ書き出した成果物一覧
  - path
  - kind
  - mimeType
  - sourceUrl
  - byteSize 相当
- `content` 側へ反映したい補助 metadata
  - duration
  - enclosure 情報
  - checksum 候補など

## 呼び出し層の責務

plugin を呼ぶ層は，plugin 自身と backend 本体の間の調停を担う．

- plugin の解決と起動
- 一時ディレクトリの払い出し
- plugin が書いた成果物の検査
- 一時ディスクから storage への移送
- storage 参照情報への変換
- backend 本体へ渡す import 用 payload の組み立て

呼び出し層は `observe` と `acquire` を別 job として実行できるようにしてよい．

この層があることで，plugin は storage 実装詳細や backend 保存 API を知らずに済む．

## worker が知る情報

worker は backend 側の都合を知ってよい．

- queue payload
- enqueue 時点の `source + collectorSettingSnapshot` 相当
- backend API / import API
- plugin の解決規則
- storage 移送規則
- `source.url` と `collectorSettingSnapshot.config` から plugin 入力をどう作るか

## plugin.observe が知る情報

`plugin.observe` は収集に必要な情報だけを知る．

- `rssUrl`
- plugin 固有 option
- logger
- timeout / abort signal
- 一時ディレクトリパス

`collectorSettingSnapshot` や backend API の完全な model は知らない．

## backend 本体の責務

- `content` の重複判定
- `content` と `content snapshot` の保存
- `asset` metadata の保存
- job 状態更新
- 一覧取得 API から見える状態への反映

## 今回の最小経路

今回のスコープでは，次の流れが成立すればよい．

1. `podcast rss source` を登録する
2. backend から初回クロール job を投入する
3. RSS plugin の `observe` が feed を取得して `content` 候補を返す
4. backend 本体が `content` と必要な snapshot を保存する
5. しばらく待つと `content` 一覧 API または frontend から見える

`acquire` による実リソース取得と `asset` 保存は，この最小経路の次段で扱う．

## 未決事項

- `content` の一意判定キー
- `content snapshot` を毎回増やすか，最初は最小構成にするか
- `observe` と `acquire` の共通 interface をどう切るか
- import payload の具体 shape
- plugin が feed レベル metadata をどこまで返すか
- 一時ディレクトリの掃除タイミング
- storage への移送失敗時の再試行と後始末
- `source.url` をそのまま `rssUrl` として使うか，plugin ごとに入力変換層を持つか

## docs への整理先

- 現時点の最終的なアーキテクチャ説明は [plugin](../plugin.md) に寄せる
- ADR は判断だけを残し，具体的な流れや構成図相当は `docs/plugin.md` で更新していく
