# ADR-0046: transcript 要求と scribe polling は backend job で扱う

## ステータス

決定

## 範囲

`api backend`, `crawler`, `job`, `web ui frontend`

## コンテキスト

- transcript 要求は `content detail` から audio asset に対して明示的に発行したい
- `scribe` の現行 API は `POST /transcribe` で request を起票し，`GET /transcribe/{request_id}` を polling して結果を得る非同期 job 形である
- `geshi` 側でも，音声の WAV 化，`scribe` への request，状態確認，結果反映を同期 HTTP request の中へ押し込むのは重い
- podcast 1 時間分のような長時間 audio を単一 WAV にして upload すると，数百 MB 級になり現実的でない
- 同一 audio asset に対する多重要求は禁止したいので，要求受付と進行状態の管理主体が必要になる
- summarization は後段だが，transcription の job orchestration を定めておくことが前提になる

## 決定

- transcript 要求は backend API で受け付け，実際の処理は backend job として実行する
- transcript job は，少なくとも次の責務を持つ
  - 対象 audio asset の確定
  - job 全体の orchestration
  - 子 job の状態集約
  - 成功または失敗の終状態への反映
- transcript 処理は，少なくとも次の 2 種の job に分ける
  - `分割ジョブ`
    - `ffmpeg` を用いた `scribe` 入力用の WAV 化
    - upload 可能な単位への chunk 分割
    - chunk ごとの transcript sub-job の enqueue
    - 一時生成物の削除
  - `chunk transcription ジョブ`
    - 個別 chunk に対する `scribe` transcription request 起票
    - 個別 `scribe` job 状態の polling
    - chunk 単位の結果保存
- 親となる transcript job は，chunk ごとの transcript を 1 つの transcript へ束ねる責務を持つ
- transcript 要求の対象は，`content` に属する audio asset 全てとする
- 同一 audio asset に対して transcript job が未完了の間は，新しい transcript 要求を受け付けない
- transcript job の進行状態は，`scribe` 側の `pending` / `working` / `done` / `error` を吸収しつつ，`geshi` 側の job / domain 状態として参照できるようにする
- `scribe` が返す `request_id` は transcript 本体ではなく，`metadata jsonb` を保持できるよう拡張した transcript job 側で永続化する
- 既存 `jobs` は，provider 固有の進行情報を保持できる `metadata jsonb` を持つ方向で拡張する
- `transcriptId` と `transcriptChunkId` は job payload に含め，worker が polling 結果を書き戻す対象を特定できるようにする
- `transcript-split` job は metadata を持たない前提で扱う
- `transcript-chunk` job の metadata には `scribeRequestId` だけを保持する
- chunk transcription ジョブの retry 時は，job 側に永続化された chunk ごとの `request_id` があれば新しい `POST /transcribe` を送らず，既存 request に対する polling を再開できるようにする
- WAV 変換結果と chunk 分割後の音声データは，`asset` 用の永続 `storage` とは別の，作業用 `storage` に置く
- 作業用 `storage` の当面の実装は local filesystem でよいが，job 間の受け渡しは `/tmp/foo/chunk1.wav` のような host 固有 path ではなく，作業用 `storage` の key またはそれに準じる参照で行う
- split job は chunk 音声を作業用 `storage` へ保存し，chunk job は payload 内の作業用 key を使ってそれを読み出す
- 作業用 `storage` 上の一時生成物は，処理終了時に削除する
- 明示再試行や worker retry では，一時生成物を再利用せず，都度 WAV 変換と chunk 分割をやり直す
- 上記の domain 状態は job テーブルだけに閉じず，対応する `transcript` 主体にも写して，UI が transcript 単位で進行中か終了済みかを参照できるようにする
- `content detail` は独立画面へ遷移せず，同じ browse 文脈の中で transcript 要求状態と結果を参照できるようにする
- summarization は，transcript job の導線と保持先が固まった後段の job として追加する
- 異常系は，少なくとも次の方針で扱う
  - chunk transcription ジョブが worker failure で再実行された場合，既存 `request_id` があれば再投稿せず polling を再開する
  - `scribe` が一定時間内に終状態へ到達しない chunk は timeout 扱いにできるようにする
  - chunk ごとの成功・失敗・timeout は `transcript` の部分結果モデルへ永続化し，親 job は DB 上の状態を再読込して再集約できるようにする
  - 親 job が途中で失敗しても，DB に保存された chunk 状態から再実行時に最終状態を再計算できるようにする
  - 初期段階では，1 つでも chunk が失敗または timeout したら transcript 全体を `failed` とする
  - UI からの再試行導線は 1 つのボタンにとどめ，内部では失敗または timeout した chunk だけを再試行対象にする
  - 上記の再試行では，対象 chunk ごとに古い `request_id` を使い回さず，新しい `POST /transcribe` を発行する

## 影響

- UI 応答性を保ったまま，重い外部連携処理を非同期 job 側へ寄せられる
- transcript 要求の多重起動を backend で一貫して抑止しやすくなる
- `scribe` の polling 型 API と `geshi` の内部状態管理との写像を明示しやすくなる
- 変換処理を `ffmpeg` に寄せることで，音声形式変換を独自実装せずに済む
- `分割` と `scribe request/polling` を別 job に分けることで，再試行単位を粗い前処理と細かい chunk 処理に分離できる
- 長時間音声をそのまま巨大 upload せずに済み，現実的な転送サイズへ落としやすくなる
- 一時生成物を専用領域に閉じて終了時に削除することで，storage や永続領域へ中間ファイルを残さずに済む
- job 間の受け渡しを作業用 `storage` key に寄せることで，同一 host の filesystem 共有前提を payload 契約へ漏らさずに済む
- chunk ごとの `scribe request_id` を `metadata jsonb` 付き job 側へ持つことで，worker 再試行時に不要な再投稿を避けやすくなる
- job 側に進行状態を保持することで，UI へ transcript job 状態を返す導線を作りやすくなる
- `transcriptId` / `transcriptChunkId` を payload に置くことで，戻し先特定と metadata の責務を分離しやすくなる
- 失敗 chunk だけを UI から新規 request として再試行できるため，音声全体をやり直さずに復旧しやすくなる
- UI では chunk ごとの個別選択を要求せずに済むため，異常系導線の複雑さを抑えやすくなる
- 異常系を先に決めることで，worker crash や `scribe` timeout 時にも再開可能な設計へ寄せやすくなる
- 一方で，作業用 `storage` という別責務を定義し，その削除規則や key 設計も別途揃える必要がある
- 一方で，transcript job の受付 API，親子 job の状態集約，chunk 結合規則，`jobs.metadata` の schema 運用が別途必要になる
- 一方で，再試行のたびに変換と分割をやり直すため，計算量と I/O は増える

## 代替案

- transcript 要求を同期 HTTP request の中で完結させる
  - WAV 化，外部 request，polling を含み UI 導線に対して重すぎるため採らない
- `scribe` の polling を frontend から直接行う
  - 運用時設定と外部失敗が frontend に漏れ，重複要求抑止も難しいため採らない
- transcript 要求を plugin 境界の仕事として扱う
  - 今回の要求は収集 plugin ではなく閲覧導線から起こるため採らない
- chunk failure を無視して成功した部分だけ即 transcript 完了とみなす
  - 初期段階では失敗時の一貫性より partial success の表現を優先しないため採らない
- 失敗 chunk の明示再試行でも古い `request_id` を再利用する
  - 利用者が「やり直し」を選んだ意図に反し，壊れた外部 job を引きずるため採らない
- split job と chunk job の間で local filesystem path を直接受け渡す
  - 同一 host の共有 filesystem 前提が job 契約に埋め込まれ，将来 worker 配置や storage 実装を変えにくくなるため採らない

## 参考資料

- [ADR-0010] ADR-0010: source クロールの実行基盤として job queue を導入する
- [ADR-0025] ADR-0025: crawl job は worker 実行に必要な情報を enqueue 時点で持つ
- [ADR-0044] ADR-0044: scribe 連携は adapter 境界に閉じ込める
- [ADR-0045] ADR-0045: transcript は content に直接ひもづく主体として保持する

[ADR-0010]: ./0010-source-crawl-job-queue.md
[ADR-0025]: ./0025-crawl-worker-input-interface.md
[ADR-0044]: ./0044-scribe-integration-boundary.md
[ADR-0045]: ./0045-transcript-owned-by-content.md
