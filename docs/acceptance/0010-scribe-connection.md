# Scribe Connection

この開発項目では，`geshi` が `scribe` を外部連携先として扱うために，接続責務，設定方法，失敗モード，検証方針を文書で固定し，実装着手に必要な前提を揃えることを受け入れ条件とする．

現時点での `scribe` 実体は `/home/office/src/github.com/t-ashula/scribe` にある Python / FastAPI 製の非同期 API server であり，`POST /transcribe` と `GET /transcribe/{request_id}` を中心に Redis / RQ ベースの job 処理を行う．

## 受け入れ条件

- `geshi` のどの責務境界が `scribe` と通信するかが文書化されている
- `scribe` 連携を `source collector plugin` に持ち込むのか，`backend` / worker / CLI 側の責務として扱うのかが判断されている
- `scribe` 接続に必要な endpoint，credential，timeout などの運用時設定の置き場所が文書化されている
- `scribe` の `POST /transcribe` が `audio/x-wav` の upload を前提とし，結果取得が polling 型 job API であることを前提に，`geshi` 側の入力・待機・結果反映の責務が文書化されている
- secret を `source` や `collector setting` に混在させない方針が文書化されている
- `geshi` 内部の domain model や plugin 契約に，`scribe` 固有の request / response shape を直接漏らさない方針が文書化されている
- `scribe` 呼び出しの成功時と失敗時に，どの層が retry，可観測性，利用者向け error 表現を担うかが文書化されている
- `scribe` 連携が必要とする最小単位の adapter / service interface が文書化されている
- `scribe` 未設定時，認証失敗時，timeout 時，互換性不整合時の失敗モードが整理されている
- `scribe` の `pending` / `working` / `done` / `error` を，`geshi` 側でどの job 状態または永続化状態へ写像するかが整理されている
- `tmp/v0.3.0/packages/scribe-client` の残骸を，そのまま使うのか，移植するのか，捨てて作り直すのかが判断されている
- 実装時に必要な test 観点が，unit / integration / e2e のどこで確認するかまで含めて整理されている
- この開発項目で扱う範囲と，後続タスクへ送る論点が分離されている

## 確認方法

- `scribe` 連携の責務境界が ADR で明示されていることを確認する
- 設定値と secret の置き場所が，既存の運用時設定方針と矛盾しないことを ADR と Design log で確認する
- `scribe` API の upload 制約，polling 前提，結果 TTL が ADR または Design log で前提として固定されていることを確認する
- `scribe` 固有の入出力 shape を内部契約へ直接露出しない理由が ADR で説明されていることを確認する
- `tmp/v0.3.0/packages/scribe-client` の再利用方針と，現行 `scribe` API との差分が Design log で整理されていることを確認する
- 失敗モードと retry 方針が，呼び出し層と利用者向け表現の両面から整理されていることを確認する
- 実装着手前に，未確定事項が Design log へ切り分けられていることを確認する
