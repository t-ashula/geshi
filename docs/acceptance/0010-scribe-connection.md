# Scribe Connection

この開発項目では，`geshi` が `scribe` を外部連携先として扱うために，接続責務，設定方法，失敗モード，検証方針を文書で固定し，実装着手に必要な前提を揃えることを受け入れ条件とする．

## 受け入れ条件

- `geshi` のどの責務境界が `scribe` と通信するかが文書化されている
- `scribe` 連携を `source collector plugin` に持ち込むのか，`backend` / worker / CLI 側の責務として扱うのかが判断されている
- `scribe` 接続に必要な endpoint，credential，timeout などの運用時設定の置き場所が文書化されている
- secret を `source` や `collector setting` に混在させない方針が文書化されている
- `geshi` 内部の domain model や plugin 契約に，`scribe` 固有の request / response shape を直接漏らさない方針が文書化されている
- `scribe` 呼び出しの成功時と失敗時に，どの層が retry，可観測性，利用者向け error 表現を担うかが文書化されている
- `scribe` 連携が必要とする最小単位の adapter / service interface が文書化されている
- `scribe` 未設定時，認証失敗時，timeout 時，互換性不整合時の失敗モードが整理されている
- 実装時に必要な test 観点が，unit / integration / e2e のどこで確認するかまで含めて整理されている
- この開発項目で扱う範囲と，後続タスクへ送る論点が分離されている

## 確認方法

- `scribe` 連携の責務境界が ADR で明示されていることを確認する
- 設定値と secret の置き場所が，既存の運用時設定方針と矛盾しないことを ADR と Design log で確認する
- `scribe` 固有の入出力 shape を内部契約へ直接露出しない理由が ADR で説明されていることを確認する
- 失敗モードと retry 方針が，呼び出し層と利用者向け表現の両面から整理されていることを確認する
- 実装着手前に，未確定事項が Design log へ切り分けられていることを確認する
