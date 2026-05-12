# ADR-0051: observed asset と record job cleanup は next-action policy で期限と非 action 理由を表現する

## ステータス

決定

## 範囲

`plugin`, `sdk`, `job`, `worker`, `web ui frontend`

## コンテキスト

- [ADR-0047] では，`observe` の返り値に asset ごとの next-action policy を持たせる方針を定めている
- [ADR-0048] では，`actionKind=record` の asset から `record-content` job を生成する方針を定めている
- しかし録音系 source では，「asset は観測できるが，この時点では job を生成してはいけない」ケースがある
- 例えば次のようなケースがある
  - 放送終了後であり録音不能
  - retention window 外であり取得不能
  - source 固有制約により自動取得対象外
  - 手動操作や追加 capability が必要
- また `record-content` job は，observe 時点では有効でも，scheduler が実行する時点ではすでに録音不能になっていることがある
- この場合も，「job が失敗した」のではなく「もう action 対象ではない」という理由を一貫して表現できる必要がある
- さらに，録音系 source では「いつ開始すべきか」だけでなく「いつまでなら開始してよいか」も source 固有に決まる
- 例えば radiko では，14:00 開始 14:30 終了の番組に対して `record` を返していても，scheduler が 15:00 まで止まっていればその job はどうやっても成功不能である
- この場合，単に retryable job として残し続けるのではなく，「実行期限を過ぎたため non-actionable になった」と扱える policy が必要になる
- 現状の暗黙規則では，`nextAction` が無い asset は実質的に `acquire` と同じように扱われやすく，「job を生成しないこと」と「まだ policy を付けていないこと」とを区別できない
- この曖昧さがあると，worker 側で誤って job を生成したり，frontend で「未取得」と「取得対象外」とを分けて表示できない

## 決定

- observed asset の next-action policy は，「job を生成しない」という明示的状態を表現できなければならない
- 上記状態は `actionKind: "none"` で表現する
- `actionKind: "none"` は，少なくとも machine-readable な `reason` を持つ
- `reason` は plugin 固有 free text ではなく，core 側でも分岐可能な有限集合として定義する
- 利用者向け説明が必要な場合に備えて，`message` を任意で持ってよい
- `actionKind: "record"` や `actionKind: "acquire"` も，必要に応じて「いつまで実行可能か」を表す期限を持ってよい
- 上記期限は，少なくとも `latestRunnableAt` のような時刻として表現できなければならない
- また next-action policy は，期限超過時にどう扱うかも表現できなければならない
- 例えば `expirationPolicy` のような shape で，期限超過時の扱いと non-actionable reason を持てるようにする
- `observe-source` worker は `actionKind: "none"` の asset からは後続 job を生成しない
- `observe-source` worker は `actionKind` 未指定を暗黙に `acquire` とみなさない
- `recording-scheduler` など後段 worker は，もともと `record` として job 化された asset でも，実行時点で `latestRunnableAt` を過ぎて non-actionable になっていれば cleanup してよい
- 上記 cleanup の理由も，`actionKind: "none"` と同じ reason 集合に対応づけて扱う
- したがって policy は，「今 action するか」だけでなく「いつまで action できるか」「期限切れ時にどう扱うか」まで含める
- したがって core は，「observe 時点で job を作らない理由」と「scheduler 時点で job を潰す理由」とを別々の概念として増やさない
- したがって next-action policy は，後続 job を必要とする asset だけでなく，「job 化しない asset」の状態も含めて明示する契約として扱う
- frontend は `actionKind: "none"` を「未取得」ではなく「取得対象外」またはそれに相当する状態として表示してよい

## 影響

- plugin SDK の next-action policy shape に `actionKind: "none"` と `reason` が追加で必要になる
- plugin SDK の next-action policy shape に `latestRunnableAt` と `expirationPolicy` が追加で必要になる
- `observe-source` worker の後続 job 分岐は，`acquire` / `record` / `none` を明示的に扱う実装へ変わる
- `recording-scheduler` などの job orchestrator は，実行不能になった queued `record-content` job を，policy の期限と reason に基づいて cleanup する実装が必要になる
- 録音系 plugin は，「観測はできるが job は作らない」asset を安全に返せる
- 録音系 plugin は，「いまは record 対象だが，この時刻を過ぎたらもう実行不能」という期限付き action を返せる
- frontend は job 未生成の理由や cleanup 理由を，単なる空欄や未取得ではなく意味のある状態として表示できる
- core 側で暗黙規則を減らせる一方，既存 plugin の next-action policy 移行が必要になる

## 代替案

- `nextAction` が無いことを「job を生成しない」の意味として扱う
  - policy 未設定と非 action 対象とを区別できないため採らない
- observe 時点の `none` と scheduler 時点の cleanup を別々の reason 系で持つ
  - frontend と worker の分岐が二重化し，一貫した状態表現にならないため採らない
- action の期限切れは queue の retry 回数や generic failure だけで表現する
  - source 固有の「もう成功不能」を表せず，scheduler cleanup と UI 表示を安定して扱えないため採らない
- `asset.kind` や URL から worker 側が「これは録音対象外だろう」と推測する
  - source 固有知識が core 側へ漏れるため採らない
- `actionKind: "none"` は持たせるが，理由は free text のみとする
  - core 側や frontend 側で安定して分岐できないため採らない
- 「job を生成しない」asset 自体を `observe` から返さない
  - 観測結果として asset が存在することと，後続 job を起こさないこととを分けて扱えないため採らない

## 参考資料

- [ADR-0047] ADR-0047: `observe` 結果は asset ごとの next-action policy を含める
- [ADR-0048] ADR-0048: 録画系 acquire は専用 job orchestration と複数 worker 前提で扱う
- [ADR-0050] ADR-0050: plugin と job の一般インタフェースとして next-action arguments と共通実行 context を定義する

[ADR-0047]: ./0047-observed-asset-next-action-policy.md
[ADR-0048]: ./0048-recording-job-orchestration.md
[ADR-0050]: ./0050-plugin-and-job-shared-interface.md
