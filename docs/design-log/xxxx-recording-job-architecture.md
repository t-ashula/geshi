# Design Log xxxx: 録画系 job の責務分割

## 背景

- `geshi` は `podcast` だけでなく `streams` や `feeds` も対象にする前提を持つ
- 既存の `source collector plugin` 契約は `observe` と `acquire` を中心に整理されている
- 現行の `acquire-content` worker は plugin の `acquire` が返す `Uint8Array` をそのまま永続 `storage` へ保存する形で，数十秒で終わる download 系処理を前提にしている
- 一方で live stream の録画は，「配信開始時刻まで待つ」「数十分から数時間動き続ける」「segment や一時ファイルを作る」「終了後に final file を確定する」という性質を持つ
- podcast 向けに自然だった `observe -> acquire` の即時実行モデルをそのまま録画へ広げると，job の意味，plugin 契約，storage の責務が崩れやすい

## いまの構成で詰まる点

### `acquire` 契約が download 前提

- SDK の `SourceCollectorAcquireInput` / `AcquiredAsset` は，plugin が最終ファイル全体を `body: Uint8Array` として返す形である
- これは RSS enclosure や HTML snapshot のような比較的 bounded な取得には合う
- しかし録画対象の video を memory に載せ切って返すのは不適切で，長時間録画や segment 収集に向かない

### `observe-source` が acquire を即投入する

- 現行 `observe-source` worker は，`assetIdsRequiringAcquire` を見つけるとその場で `acquire-content` job を enqueue する
- これは「今もう取れる asset」を対象にするには自然だが，「今はまだ放送前で，予定時刻になったら録画したい asset」には合わない
- 録画では，`発見` と `取得開始可能時刻` と `録画終了後の確定` を分けて扱う必要がある
- 現行の `observe` の返り値，とくに `observeResult.contents` は，後続 job 種別を分けるための next-action policy を十分に持っていない
- そのため実装上は `observe-source` worker が `assetIdsRequiringAcquire` を見たら `acquire-content` へ直結する形になっている

### worker の時間スケールが違う

- 現行 `observe` / `acquire` は `AbortSignal.timeout(30_000)` の短時間実行を前提にしている
- 録画は数時間継続しうるため，同じ timeout 感覚や retry 感覚では扱いづらい
- 失敗時も，「最初から再 download」ではなく「segment 途中からの継続」「終了待ちの再開」を考えたくなる

### 予約時刻に同種 worker を複数起動できる前提がまだ薄い

- 現行のローカル起動導線は `worker:start` で各 queue を 1 process ずつ起動する形である
- `pg-boss` 自体は複数 worker process から同一 queue を購読できる前提だが，録画系でその運用をどう使うかはまだ文書化されていない
- 予約録画では，同じ時刻に複数の `record-content` job が開始可能になることが自然に起こる
- そのとき「1 process が順番に処理する」前提だと，予約時刻を過ぎてから録画が始まる遅延が起きる
- したがって録画系 queue は，同一 job 種別の worker を複数 process 起動できることを前提に設計する必要がある

## 録画系 job に欲しい責務

録画系では少なくとも次を分けたい．

1. 録画対象の発見
2. いつ録画を始めるかの決定
3. 録画中の長時間 capture
4. 録画完了後の final file 確定
5. 保存済み `asset` / `content` 状態への反映
6. 保存済み asset / content の終状態確定

既存の `observe-source` は 1 を担えるが，2 以降は別 job として切り出した方が自然である．

## 検討案

### 案 A: 録画も現行 `acquire-content` に押し込む

- plugin `acquire` が録画完了まで待って最終 video bytes を返す
- worker は現行どおり `storage.put` する

却下理由:

- 長時間処理と巨大ファイルを `Uint8Array` 返却へ押し込むことになる
- segment や中間成果物の扱いが `plugin` 内へ閉じ，job 再開点が見えにくい
- `observe-source` の即 enqueue モデルとも噛み合わない

### 案 B: 録画専用 job を `acquire-content` から分ける

- download 系 asset は従来どおり `acquire-content` で扱う
- recording 系 asset は別 job を enqueue し，作業用 `storage` を使って段階的に確定させる

利点:

- bounded download と長時間 recording の責務を分離できる
- plugin 契約も `download` と `record` で無理なく分けられる
- transcript のときと同様に，前処理 / 実行 / 後処理を job orchestration で表現しやすい

### 案 C: 録画は plugin 外の外部 scheduler / recorder に丸ごと任せる

- `geshi` は metadata だけ持ち，録画本体は別システムが行う

今回は採らない理由:

- `geshi` の job / retry / status モデルから外れやすい
- 「録画中」「失敗」「確定済み」を UI / API から一貫して見せにくい

## 当面の推奨

案 B を前提に，録画系 job は少なくとも 2 段階へ分ける．

加えて，`record-content` は「専用 queue に対して同種 worker を複数起動できる」ことを前提にする．

### 1. `record-content` job

責務:

- 録画開始前の待機，または開始可能条件の確認
- 録画処理の実行
- segment や中間 file の作成
- 録画実行中の provider 固有状態を `jobs.metadata` へ保持
- 再試行時の再開判断

payload に持たせたいもの:

- `jobId`
- `source.id`
- `content.id`
- `asset.id`
- plugin slug と config snapshot
- 録画対象 URL または provider 固有識別子
- `notBefore`
- 録画モード
- `expectedEndAt` または録画 window

補足:

- [ADR-0025] に合わせ，worker 実行に必要な情報は enqueue 時点の snapshot として持つ
- `jobs.metadata` には，少なくとも `recordingSessionId`，`workingStoragePrefix`，`lastSeenSegment` のような provider 依存情報を置けるようにする
- 同じ `record-content` queue を処理する worker process は複数起動できる前提にする
- 各 worker は 1 つの録画 job を占有しうるので，録画本数の上限は queue 並列度ではなく worker 数で決まる
- 予約時刻集中に備えて，deploy 側で `record-content` worker replica を増やせる起動形態にする

### 録画モード

録画系 job には少なくとも次の 2 種類がある．

#### `until-stream-end`

- ある時刻から録画を開始し，対象 stream が終わるまで継続する
- 停止条件は「予定時刻の経過」ではなく「stream の終了検知」である
- provider 側の終了シグナル，playlist 更新停止，HTTP 取得失敗の継続，明示的 offline 判定などを組み合わせて終端判定する必要がある
- payload には少なくとも `notBefore` と，必要なら safety 用の `maxDuration` を持たせたい

#### `minimum-duration`

- ある時刻から録画を開始し，少なくとも指定時間は継続する
- 典型例は「最低 1 時間録画する」である
- 停止条件は，まず `minimumDurationMs` の充足であり，その後に stream が続いていてもどこで止めるかは別途方針が要る
- payload には `notBefore` と `minimumDurationMs` を持たせたい

この 2 つは「録画開始条件」だけでなく「停止条件」が違うため，同じ `record-content` job でも mode を明示して worker が分岐できるようにしたい．

### 2. `finalize-recording` job

責務:

- 作業用 `storage` 上の segment / manifest を検証する
- 必要なら結合や remux を行う
- 永続 `storage` へ最終 asset を保存する
- `asset` / `asset_snapshot` / `content.status` を更新する

補足:

- `record-content` と `finalize-recording` を分けることで，録画そのものの失敗と，後処理失敗を切り分けやすい
- transcript 系が採っている「作業用 `storage` を key で受け渡す」方針を再利用できる

## plugin 契約への含意

録画を自然に扱うには，`source collector plugin` 契約に少なくとも 1 つの追加が要る．

### `observe` の返り値の拡張方向

録画系を入れるなら，`observe-source` worker が `observe` の返り値，とくに `observeResult.contents` だけを見て後続 job を選べる必要がある．

現行の `ObservedContent` / `ObservedAsset` は，主に次を返す形である．

- `content` と `asset` の識別情報
- `publishedAt`
- `status`
- `asset.kind`
- `primary`
- `sourceUrl`
- fingerprint 群

これでは「この asset は今すぐ download するものか」「予約録画として遅延投入するものか」「どの停止条件で録画するか」が分からない．

したがって，`observe` の返り値，とくに `observeResult.contents` には少なくとも「次に取る action 方針」を表す情報を足したい．

#### 追加したい情報の粒度

基本は asset 単位で持つのがよい．

理由:

- 同じ `content` に `thumbnail` は download，`video` は record のような混在がありうる
- 後続 job は最終的に asset 単位で enqueue される
- 既存の `acquire-content` も asset 単位で処理している

#### 追加候補

`ObservedAsset` に近い位置へ，少なくとも次のような情報を持たせたい．

- `nextAction.kind`
  - `download`
  - `record`
- `nextAction.notBefore`
  - 予約開始時刻
- `nextAction.recordingMode`
  - `until-stream-end`
  - `minimum-duration`
- `nextAction.minimumDurationMs`
  - `minimum-duration` のときだけ使う
- `nextAction.expectedEndAt`
  - 分かる場合だけ
- `nextAction.maxDurationMs`
  - safety 側の停止条件
- `nextAction.providerHints`
  - playlist URL, channel id, live 判定補助などの provider 固有情報

ここで重要なのは，`observe` が「録画本体」を実行するのではなく，「後続 worker が何をすべきかを決める情報」を返すことに留める点である．

#### `observe-source` 側での使い方

拡張後のイメージは次のとおりである．

1. `observe-source` が `ObservedContent[]` を受け取る
2. 各 `ObservedAsset` の `nextAction.kind` を見る
3. `download` なら `acquire-content` を enqueue する
4. `record` なら `record-content` を enqueue する
5. `notBefore` が未来なら，即時実行ではなく遅延投入か予約状態で保持する

つまり，現在 `observe-source` worker に埋まっている `observe -> acquire-content` 固定配線を，`observeResult.contents` に含まれる next-action policy を見て分岐する形へ変えるのが狙いである．

#### content 側に持たせるか asset 側に持たせるか

原則は asset 側に寄せたいが，content 側にも補助情報を持つ余地はある．

例:

- `content.scheduledStartAt`
- `content.liveState`
  - `upcoming`
  - `live`
  - `ended`

ただし，job 分岐の決定打は asset 側の next-action policy に置く方が責務が明確である．

### 必要そうな追加 1: asset の取得方式

`observe` が返す asset に，少なくとも次の区別が欲しい．

- `download`
- `record`

これが無いと `observe-source` 側で `acquire-content` を enqueue するか，録画系 job を enqueue するかを決められない．

### 必要そうな追加 2: recording 実行 API

現行 `acquire` をそのまま拡張するより，録画は別 API にした方が責務が明確である．

例:

- `record(input): Promise<RecordingResult>`
- `resumeRecord(input): Promise<RecordingResult>`

ここでの戻り値は最終 `body` ではなく，作業用 `storage` に置いた生成物への参照や，録画セッション状態を返す形が自然である．

### 必要そうな追加 3: 録画開始条件

`observe` または別 inspect で，少なくとも以下のどれかを持ちたい．

- `notBefore`
- `scheduledStartAt`
- `liveNow`

録画系では「asset が存在する」と「今取得を始めるべき」が同義ではないためである．

## job 投入の流れの案

1. `observe-source` が upcoming または live な stream content を見つける
2. backend は `content` / `asset` を `discovered` として登録する
3. asset の取得方式が `download` なら従来どおり `acquire-content` を enqueue する
4. asset の取得方式が `record` なら `record-content` job を enqueue する
5. `record-content` が完了したら `finalize-recording` job を enqueue する
6. `finalize-recording` 成功後に `content.status` を `stored` にする

## 録画モードごとの停止条件

### `until-stream-end`

- worker は stream が live である限り録画を継続する
- stream 終了を検知したら segment flush と後処理へ進む
- 誤検知で早く止まりすぎないように，単発失敗ではなく一定回数または一定時間の不達で終了扱いにする方がよい

### `minimum-duration`

- worker は `minimumDurationMs` を満たすまで録画継続を優先する
- stream が `minimumDurationMs` を満たす前に終わった場合は `failed` とみなす
- このとき，原因が `geshi` 側の録画失敗か，配信元側が予定より早く止まったのかを明確に区別できないことが多い
- 初期段階では原因の厳密分類を成功条件へ持ち込まず，「期待した最低録画時間を満たせなかった」という事実を失敗条件として扱う方が一貫する
- failure message や `jobs.metadata` には，「stream ended before minimum duration」や「capture stopped before minimum duration reached」のような観測事実を残す

## `minimum-duration` 失敗後の扱い

`minimum-duration` が未達で終わったときは，少なくとも次の 3 案がある．

### 案 A: 同一条件で retry する

- 元の `minimumDurationMs` をそのまま再度要求する
- worker retry または新規 job で，最初から「最低 1 時間」のような条件をやり直す

利点:

- 契約が単純で，利用者が最初に要求した条件を変えない
- retry 前後で job 意味がぶれにくい

欠点:

- すでに 20 分録れていたとしても，その実績を考慮せず再度 1 時間要求することになる
- 「合計で 1 時間あればよい」の期待とはずれる可能性がある

### 案 B: 経過時間を差し引いた即時実行 job を再投入する

- たとえば 1 時間要求で 20 分録れたなら，残り 40 分を目標に即時実行 job を新規投入する
- 失敗した元 job は `failed` のまま閉じ，新しい job は別 job として扱う

利点:

- 「最低 1 時間」の意味を累積録画時間として解釈できる
- すでに取れた分を活かして不足分だけ補いやすい

欠点:

- どこまでを「同じ録画要求」と見なすかが複雑になる
- 別セッションの録画断片をどう結合し，最終 asset としてどう見せるかを追加設計する必要がある
- 元 stream がすでに終了していれば，再投入しても成立しない可能性が高い

### 案 C: 何もせず失敗で終了する

- 未達失敗を記録し，自動では再投入しない
- 必要なら利用者または上位 scheduler が再要求する

利点:

- job の意味が明確で，暗黙の再解釈が入らない
- partial recording の扱いを後段へ持ち込みにくい
- 初期段階の運用と実装が最も単純である

欠点:

- 自動復旧性は低い
- 一時的な配信揺れで止まっただけでも手動介入が要る

## 当面の推奨: 自動再投入はしない

初期段階では，`minimum-duration` が未達で止まった場合は `failed` として閉じ，自動では再投入しない案を第一候補にしたい．

理由:

- 未達停止の原因を `geshi` 側と配信元側で明確に分類しにくい
- 残時間だけの自動再投入は，「同じ録画要求」の意味と最終 asset の整合が急に複雑になる
- 同一条件 retry も，元 stream がすでに終わっている場合は成功見込みが薄い
- まずは失敗理由と録画済み長さを観測可能にし，後から retry policy を足す方が安全である

将来的に自動再投入を入れるなら，worker retry ではなく「新規 job をどういう条件で追加投入するか」を明示的な policy として持つ方がよい．

## worker 配置の前提

録画系は，既存の短時間 job よりも worker 配置の要件が厳しい．

### 同一 queue の複数 worker process

- `record-content` queue は，同一種類の worker process を複数同時起動できる前提にする
- 1 つの予約録画が 1 worker を長時間占有しても，他の予約録画が別 worker で開始できるようにする
- 予約時刻に同時起動する録画本数を，少なくとも worker replica 数まで吸収できる構成を採る

### queue の分離

- `record-content` は `observe-source` や `periodic-crawl` と別 queue にする
- 長時間録画 job が短時間の crawl / transcript orchestration job の処理枠を食い潰さないようにする

### scheduler との接続

- 予約録画の開始タイミングは，単なる `observe-source` の後続即時 enqueue だけではなく，`startAfter` を使った遅延投入か，録画開始直前の再投入を選べるようにしたい
- どちらを選んでも，「開始時刻まで queue に積まれている録画 job を捌くために複数 worker が必要」という前提は変わらない

## 検証用 fake server

録画系は，再現可能な source 側挙動を用意しないと test が不安定になりやすい．

### 背景

- 現行の `test/server/main.ts` は，固定 RSS と static mp3 を返す source server であり，podcast observe/acquire や transcript 用の最小 fixture を担っている
- しかし録画系では，`m3u8` playlist，`ts` segment，playlist の更新停止，延々と続く擬似 live stream のような振る舞い自体を再現したい
- 公開配信や実サービスに依存すると，録画停止条件や retry 条件の test が不安定になる

### 必要な fixture パターン

少なくとも次の 2 系統を fake server で再現したい．

#### 1. 単発で終わる stream

- 固定の `m3u8` を返す
- `ts` segment を有限個だけ返す
- 一定 segment 数の後は playlist 更新が止まるか，`#EXT-X-ENDLIST` を返す
- `until-stream-end` の正常終了と，`minimum-duration` の未達失敗を再現するのに使う

#### 2. 延々と続く stream

- `m3u8` の内容を request ごとに進めるか，同じ playlist を live として返し続ける
- `ts` segment を理論上無限に返せる
- 明示的に止めるまで stream が終わらない
- `minimum-duration` の達成や，長時間録画 worker の heartbeat / timeout / cancel を再現するのに使う

### 追加で欲しい挙動

- playlist が一定時間更新されない
- 特定 segment だけ 404 / 500 を返す
- segment download が途中で切れる
- 一度落ちた後に再開する
- 予約時刻前は offline で，時刻到来後に live になる

これらがあると，`until-stream-end` の終了検知と `minimum-duration` の失敗条件を分けて test しやすい．

### fake server の置き場

- 既存方針に合わせ，`test/server/` 配下へ置くのが自然である
- 当面は現在の source server を拡張するか，録画専用 route/module を追加する形でよい
- backend 本体へ test 専用 route を入れず，外部 source を模した別 process として扱う方針は維持したい

### 既製ソフトを使うか，自前実装するか

どちらでもよいが，役割を分けて考えた方がよい．

#### 既製ソフトを使うのが向く部分

- `ffmpeg` で fixture 動画から `m3u8` / `ts` を生成する部分
- 単純な有限 HLS を作る部分
- 手元で目視確認するための簡易 live stream を立てる部分

補足:

- `ffmpeg` 自体が HLS muxer を持っているので，fixture から playlist と segment を作る用途には素直に使いやすい
- ただし，それだけでは「playlist 更新停止」「特定 segment だけ失敗」「予約時刻前は offline」のような test 都合の挙動までは作りにくい

#### 自前実装が向く部分

- request ごとに playlist 内容を変える
- 特定時点で stream を終わらせる
- segment の 404 / 500 / timeout を任意に起こす
- 延々と続く擬似 live と，途中で終わる finite stream を同じ test 基盤で切り替える

補足:

- 上のような「失敗や揺らぎを制御したい」要件は，最終的に `test/server/` の Hono server で route を書く方が再現性を持たせやすい
- つまり，media 生成は既製ツール，配信挙動の制御は自前 server，という分担が自然である

### fixture API のイメージ

例:

- `/streams/finite/playlist.m3u8`
- `/streams/finite/segment-0001.ts`
- `/streams/infinite/playlist.m3u8`
- `/streams/infinite/segment-<n>.ts`

補足:

- ここでの「無限」は truly infinite bytes を 1 response で流すより，「playlist polling に応じて新 segment が出続ける」擬似 live の方が HLS 的には自然である
- 一方で，worker や recorder 実装によっては「単一 response を閉じずに流し続ける」fixture も別途あるとよい

### test で見たいこと

- `until-stream-end` が finite stream を正常終了として扱える
- `minimum-duration` が finite stream の早期終了を `failed` と扱える
- `minimum-duration` が infinite stream で所定時間到達後に成功できる
- 同時刻開始の複数録画で，複数 worker が並行して処理できる
- segment の一時失敗と，終了検知とを取り違えない
- retry しない初期方針のもとで，未達失敗がそのまま `failed` に残る

## `jobs.metadata` の使いどころ

録画では provider 固有の進行情報を job 側へ持たせる価値が高い．

例:

- 録画セッション ID
- segment cursor
- manifest URL
- working storage key prefix
- 実開始時刻
- 直近の heartbeat 時刻

これは [ADR-0046] が transcript chunk job に `scribeRequestId` を持たせたのと同じ発想である．

## まだ決め切れていない点

### `sourceKind` の増やし方

- 現行 SDK は `feed | podcast` だけを前提にしている
- streaming / recording source を `stream` として増やすか，`video` や `channel` と分けるかは別 ADR で決めたい

### scheduler の責務

- `record-content` を `observe-source` 直後に delay enqueue するか
- `periodic-crawl` が録画 window に近い content だけを拾って投入するか
- 長時間 job を `pg-boss` にどこまで任せるか
- 録画予約本数に応じた worker replica 数や同時実行上限を，runtime 設定でどう表現するか
- `minimum-duration` 未達失敗時に，自動再投入 policy を scheduler 側で持つか，job 側で閉じるか

### domain 状態

- `content.status = discovered/stored/failed` だけで録画中を十分に表せるか
- `asset` か別主体に `recording` 固有状態を持たせるか
- `minimum-duration` で最低時間未達のまま stream が終わったケースを，失敗としてどの粒度で理由保持するか

## 当面の設計方針

- download 系 acquire と recording 系 acquire を同じ worker / 同じ plugin 戻り値に押し込めない
- recording 系は `record-content` と `finalize-recording` の 2 段階を基本とする
- job 間の中間生成物受け渡しは永続 `storage` ではなく作業用 `storage` key で行う
- provider 固有の再開情報は `jobs.metadata` に閉じ込める
- `record-content` queue は同種 worker を水平複数起動できる前提で，録画集中時の開始遅延を吸収する
- `minimum-duration` モードでは，最低録画時間未達で停止したケースは原因未確定でも `failed` として扱う
- `minimum-duration` 未達失敗後は，初期段階では自動再投入せず failed で閉じる

## 次に ADR 化したい論点

1. 録画系 asset の取得方式を plugin 契約でどう表現するか
2. `record-content` / `finalize-recording` を正式な job 種別として導入するか
3. streaming source kind と登録 UI をどう増やすか
4. `until-stream-end` の終了検知と timeout/safety 条件をどう定義するか
5. 将来 `minimum-duration` 未達失敗に自動再投入 policy を入れるなら，scheduler policy と asset 結合規則をどう置くか

## 参考

- [ADR-0010] ADR-0010: source クロールの実行基盤として job queue を導入する
- [ADR-0012] ADR-0012: source collector plugin の observe と acquire の責務境界
- [ADR-0025] ADR-0025: crawl job は worker 実行に必要な情報を enqueue 時点で持つ
- [ADR-0029] ADR-0029: 定期クロール job は source 設定を走査して observe-source を投入する
- [ADR-0046] ADR-0046: transcript 要求と scribe polling は backend job で扱う
- [job-queue] Job Queue
- [storage] Storage

[ADR-0010]: ../decisions/0010-source-crawl-job-queue.md
[ADR-0012]: ../decisions/0012-podcast-rss-observe-and-acquire-boundary.md
[ADR-0025]: ../decisions/0025-crawl-worker-input-interface.md
[ADR-0029]: ../decisions/0029-periodic-source-crawl-scheduling.md
[ADR-0046]: ../decisions/0046-transcript-job-orchestration.md
[job-queue]: ../job-queue.md
[storage]: ../storage.md
