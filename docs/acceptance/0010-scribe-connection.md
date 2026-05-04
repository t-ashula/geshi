# Scribe Connection

この開発項目では，`geshi` が `scribe` を外部連携先として扱うために，接続責務，設定方法，失敗モード，検証方針を文書で固定し，実装着手に必要な前提を揃えることを受け入れ条件とする．

現時点での `scribe` 実体は `/home/office/src/github.com/t-ashula/scribe` にある Python / FastAPI 製の非同期 API server であり，`POST /transcribe` と `GET /transcribe/{request_id}` を中心に Redis / RQ ベースの job 処理を行う．

## 受け入れ条件

- この開発項目の `scribe` 連携スコープは，最終的に transcription と summarization の両方を視野に入れつつ，初手の実装対象は transcription であることが文書化されている
- `geshi` のどの責務境界が `scribe` と通信するかが文書化されている
- `scribe` 連携を `source collector plugin` に持ち込むのか，`backend` / worker / CLI 側の責務として扱うのかが判断されている
- transcript 要求は `content` 画面内から audio asset に対して発行できることが文書化されている
- transcript 要求の対象は，`content` に属する audio asset 全てであることが文書化されている
- ある audio asset に対して transcript 要求が出てから成功または失敗の終状態に至るまで，同じ asset に対する追加要求を出せないことが文書化されている
- `scribe` 接続に必要な endpoint，credential，timeout などの運用時設定の置き場所が文書化されている
- `scribe` の `POST /transcribe` が `audio/x-wav` の upload を前提とし，結果取得が polling 型 job API であることを前提に，`geshi` 側の入力・待機・結果反映の責務が文書化されている
- secret を `source` や `collector setting` に混在させない方針が文書化されている
- `geshi` 内部の domain model や plugin 契約に，`scribe` 固有の request / response shape を直接漏らさない方針が文書化されている
- `scribe` 呼び出しの成功時と失敗時に，どの層が retry，可観測性，利用者向け error 表現を担うかが文書化されている
- `scribe` 連携が必要とする最小単位の adapter / service interface が文書化されている
- transcript のための `geshi` 側処理は job で賄い，少なくとも音声の WAV 化と `scribe` へのアクセスを非同期 job 境界で扱うことが文書化されている
- 上記の WAV 化は `ffmpeg` を用いる方針が文書化されている
- WAV 変換結果と chunk 分割後の音声データは，`asset` 用永続 `storage` とは別の作業用 `storage` に置き，処理終了時に削除する方針が文書化されている
- split job と chunk job の受け渡しは local filesystem path ではなく，作業用 `storage` の key または同等の参照で行う方針が文書化されている
- 長時間 audio asset を 1 つの巨大 WAV としてそのまま upload しない方針が文書化されている
- `geshi` 側で upload 可能な単位へ分割し，複数の `scribe` request を束ねて 1 transcript を構成する job 設計が文書化されている
- 上記の job 設計は，少なくとも `分割ジョブ` と `chunk を scribe に送るジョブ` を分ける方針が文書化されている
- `scribe` の `request_id` は transcript 本体ではなく，`metadata jsonb` を保持できるよう拡張した `transcript-chunk` job 側で永続化する方針が文書化されている
- `transcriptId` や `transcriptChunkId` は job payload に含めて書き戻し先を特定し，job metadata は `scribeRequestId` だけに絞る方針が文書化されている
- `scribe` 未設定時，認証失敗時，timeout 時，互換性不整合時の失敗モードが整理されている
- `scribe` の `pending` / `working` / `done` / `error` を，`geshi` 側でどの job 状態または永続化状態へ写像するかが整理されている
- worker crash, chunk failure, `scribe` timeout の異常系で，retry と transcript 全体状態への反映方針が整理されている
- UI 上の再試行導線は 1 つのボタンに抑えつつ，内部では失敗または timeout した chunk だけを再試行し，その際は古い `request_id` を使い回さない方針が整理されている
- 再試行時は一時生成物を再利用せず，都度 WAV 変換と chunk 分割をやり直す方針が整理されている
- 文字起こし結果は派生 asset としてではなく，`content` に直接ひもづく `transcript` 主体として扱う案が優先候補として文書化されている
- 上記の `transcript` 主体は，生成元の audio `asset snapshot` を参照または同等の由来情報を保持できる方針が文書化されている
- 上記の `transcript` 主体は，少なくとも「要求済みで実行中」と「終了済み」を表せる状態を持つ方針が文書化されている
- 上記の `transcript` 主体または関連モデルは，chunk 分割された transcription 結果を保持し，最終結合前後の両方を扱える方針が文書化されている
- failure retry とは別に，同じ audio に対して再度の文字起こしを明示的に行える余地を最初から持ち，`transcript` には何度目の文字起こしかを識別する軸がある方針が文書化されている
- `content` に複数の audio asset またはその版違いがある場合でも，どの音源に対する transcript かを UI 上で判別できる方針が文書化されている
- 上記の判別を成立させるために，`content detail` などの API 応答が transcript の生成元 `asset snapshot` 由来の音源識別情報を UI へ渡せることが文書化されている
- UI は transcript 導線のために独立した第 4 画面を作らず，既存の `content detail` 文脈の中で完結することが文書化されている
- transcript 導線を追加しても，長期的には利用者が `asset` を前面に意識しなくても `content` 画面から扱える方向を阻害しないことが文書化されている
- `tmp/v0.3.0/packages/scribe-client` の残骸を，そのまま使うのか，移植するのか，捨てて作り直すのかが判断されている
- `scribe` 本体は git submodule にせず，sibling checkout を `compose` / `Makefile` から起動する開発用入口を `geshi` 側へ持つ方針が判断されている
- 実装時に必要な test 観点が，unit / integration / e2e のどこで確認するかまで含めて整理されている
- この開発項目で扱う範囲と，後続タスクへ送る論点が分離されている

## 確認方法

- `scribe` 連携の責務境界が ADR で明示されていることを確認する
- 設定値と secret の置き場所が，既存の運用時設定方針と矛盾しないことを ADR と Design log で確認する
- `scribe` API の upload 制約，polling 前提，結果 TTL が ADR または Design log で前提として固定されていることを確認する
- `scribe` 固有の入出力 shape を内部契約へ直接露出しない理由が ADR で説明されていることを確認する
- transcript 要求の UI 起点，重複実行防止，job 化，`transcript` 主体の保持方針が ADR または Design log で整理されていることを確認する
- transcript 主体に保持する進行状態と終状態が ADR または Design log で整理されていることを確認する
- `scribe request_id` を任意データ付き job 側へ永続化する理由と，retry 時に同一 request を再利用する方針が ADR または Design log で整理されていることを確認する
- 複数 audio asset がある `content` でも transcript の生成元を誤認しない UI 方針が ADR または Design log で整理されていることを確認する
- transcript の生成元判別に必要な `asset snapshot` 由来情報が API 応答へ含まれる方針が ADR または Design log で整理されていることを確認する
- `tmp/v0.3.0/packages/scribe-client` の再利用方針と，現行 `scribe` API との差分が Design log で整理されていることを確認する
- `scribe` を git submodule にせず sibling checkout 起動を採る理由が Design log で整理されていることを確認する
- 失敗モードと retry 方針が，呼び出し層と利用者向け表現の両面から整理されていることを確認する
- 実装着手前に，未確定事項が Design log へ切り分けられていることを確認する
