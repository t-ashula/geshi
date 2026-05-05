# ADR-0048: 録画系 acquire は専用 job orchestration と複数 worker 前提で扱う

## ステータス

提案

## 範囲

`crawler`, `job`, `worker`, `storage`

## コンテキスト

- 現行 `acquire-content` は plugin `acquire` が返す `Uint8Array` を永続 `storage` へ保存する bounded download を前提にしている
- 録画系 source では，開始時刻待ち，長時間実行，中間 segment，終了検知，後処理が必要であり，同じ worker 契約とするには差が大きい
- 予約録画では，同時刻に複数 job が開始可能になるため，同種 worker を複数 process 起動できないと開始遅延が出る
- 録画の具体的な実行は source ごとの差が大きく，core 側で統一 recorder を持つより plugin 実装へ委ねる方が自然な可能性が高い
- その場合，plugin との境界に録画系 API が無いままでは，`record-content` worker が何を呼ぶのかを定義できない
- 一方で，録画中の途中経過を `jobs.metadata` に残したいなら，core 側が `await plugin.record()` の外から進行情報を観測することはできない

## 決定

- 録画系 acquire は，既存 `acquire-content` と分けて専用 job で扱う
- 録画系では，少なくとも `record-content` job を持つ
- 上記 job に対応して，plugin 契約にも少なくとも `record` API 境界を追加する
- `record-content` は plugin の `record` を呼ぶ job として扱う
- `record-content` は core 側で録画アルゴリズムを実装するのではなく，対象 plugin の録画実装を呼ぶ job として扱う
- `record` が受け取る `arguments` と実行 context の一般 shape は [ADR-0050] に従う
- `record-content` は次を担う
  - plugin が持つ録画処理の実行
  - `asset` / `content` 状態更新
- plugin は source 固有の録画手順，終了判定，必要なら中間生成物の扱いや結合も含めて担い，core 側 job は待機，起動，保存反映を担う
- 途中経過の生成は plugin が担い，metadata の正本保存は core 側が担う
- `record` の具体 shape は別途 SDK 側で詰めるが，少なくとも job 側が source 固有 recorder を直接実装しない境界はここで固定する
- `scheduledStartAt` は `record-content` job 自体が待機するための値ではなく，job をいつ起こすかを決めるための情報として扱う
- したがって `record-content` worker は，開始された時点で録画を実行する job として扱う
- `observe-source` は，`actionKind=record` の asset に対して `record-content` job を `jobRepository` へ作る
- 上記 job の `jobs.metadata.plugin.arguments` には，`observe` が返した next-action policy の `arguments` を引き継ぐ
- ただし，上記の時点では `record-content` job をまだ `jobQueue` へは投入しない
- 録画系では，予定時刻に開始可能な `record-content` job が複数同時に存在しうる前提で扱う
- そのため，`record-content` worker を起動するだけの常駐 worker を 1 つ置く
- 上記の常駐 worker は，既存の `periodic-crawl` worker とは分ける
- 上記の常駐 worker は，`jobRepository` にある未実行かつ未 enqueue の `record-content` job のうち，`scheduledStartAt` が近づいたものを見つける
- 上記の常駐 worker は，対象 `record-content` job を `jobQueue` に投入する
- その結果として，予定時刻に間に合うよう `record-content` worker process を必要本数だけ起動させる
- `record-content` 自体は録画実行だけに責務を絞り，worker 起動制御は上記の常駐 worker へ分離する
- 各 `record-content` worker process は，`pg-boss` の通常 worker モデルに従って担当 job を 1 つ処理したら退場する one-shot process として扱う
- これにより，必要な `record-content` worker process 数を「同時に開始・継続している録画 job 数」に近い形で見積もりやすくする

## 影響

- 新しい job 種別と worker 起動単位が必要になる
- plugin SDK に録画系 API 境界が追加で必要になる
- job payload に録画系の情報を持たせる必要がある
- plugin と job の一般インタフェースとして `arguments` と共通実行 context が必要になる
- bounded download と長時間 recording の経路を分けるため，worker 契約と retry 単位を保ちやすくなる
- queue を分けることで，長時間録画が短時間 job の処理枠を食い潰しにくくなる
- source ごとに異なる録画実装を plugin へ閉じ込めつつ，録画 job の起動と結果反映は core 側で揃えやすくなる
- `observe-source` 時点の予約登録と，`recording-scheduler` による queue 投入とを分けることで，待機を worker の外へ出せる
- `periodic-crawl` を source 走査と `observe-source` 投入に限定したまま，録画予約の起動制御を別主体へ分離できる
- 予約時刻に対して必要本数の `record-content` worker process を起動するための常駐 worker が追加で必要になる
- `record-content` worker を 1 job 後に退場する process にすることで，録画終了後の process 回収と必要本数の計算が単純になる
- 一方で，自動再投入 policy や plugin ごとの成功条件表現の扱いは後続論点として残る

## 代替案

- 録画も `acquire-content` に押し込む
  - 長時間実行，中間生成物，再開情報の扱いが不自然になるため採らない
- core 側に source 非依存の共通 recorder 実装を持ち，plugin は URL などの入力だけ返す
  - 終了判定や中間生成物の扱いまで source 差分が大きく，core 側へ責務が寄りすぎるため採らない
- plugin API は `observe` だけ拡張し，録画実行は worker が暗黙に実装する
  - plugin に委ねると決めた録画手順の境界が曖昧になり，core 側へ実装が漏れるため採らない
- plugin `record` は単発で呼ぶが，途中経過は返さず metadata 更新手段も持たせない
  - 録画中の進行情報を残したい要件を満たせないため採らない
- `observe-source` の時点で `record-content` をそのまま `jobQueue` へ投入し，worker の中で `scheduledStartAt` まで待たせる
  - 予約件数分だけ worker を占有し，必要本数の見積もりとも整合しにくいため採らない
- `periodic-crawl` worker に録画予約の起動制御も持たせる
  - 既存 ADR-0029 の「source 走査と observe-source 投入に責務を限定する」方針から外れ，source crawl と録画予約起動が混ざるため採らない
- 複数 worker 起動の仕組みを決めず，常に固定本数の worker がたまたま足りる前提で進める
  - 録画予約の同時開始を要件として扱えなくなるため採らない
- `record-content` worker を常駐 process として使い回し，どの録画をいつ担当するかを内部で調停する
  - 長時間占有と process 本数見積もりの関係が分かりにくくなり，予約時刻に必要な起動数を計算しにくいため採らない

## 参考資料

- [ADR-0010] ADR-0010: source クロールの実行基盤として job queue を導入する
- [ADR-0025] ADR-0025: crawl job は worker 実行に必要な情報を enqueue 時点で持つ
- [ADR-0029] ADR-0029: 定期クロール job は source 設定を走査して observe-source を投入する
- [ADR-0046] ADR-0046: transcript 要求と scribe polling は backend job で扱う
- [acceptance-0011] Recording Job Foundation

[ADR-0010]: ./0010-source-crawl-job-queue.md
[ADR-0025]: ./0025-crawl-worker-input-interface.md
[ADR-0029]: ./0029-periodic-source-crawl-scheduling.md
[ADR-0046]: ./0046-transcript-job-orchestration.md
[ADR-0050]: ./0050-plugin-and-job-shared-interface.md
[acceptance-0011]: ../acceptance/0011-recording-job-foundation.md
