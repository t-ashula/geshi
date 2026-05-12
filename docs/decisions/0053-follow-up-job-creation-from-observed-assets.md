# ADR-0053: 同じ asset に対する同種 job の重複生成を許容する条件を明示する

## ステータス

決定

## 範囲

`api backend`, `job`, `worker`

## コンテキスト

- [ADR-0017] では，`observe` 結果の登録後に「取得すべき `asset`」や「再取得すべき `asset`」を識別する規則を定めている
- 現行実装では，上記の規則を「同じ `asset` に対して新しい job を作ってよい条件」としても流用している
- その結果，`observed asset fingerprint` が一致している既存 `asset` でも，`acquired_fingerprint === null` である限り observe のたびに同じ job が追加されうる
- この問題は `record-content` で顕在化したが，原理的には `acquire-content` でも起こりうる
- ここで決めるべきことは，`asset` が要 action 状態であること自体ではなく，同じ `asset` に対して同じ `actionKind` の job を複数生成してよい条件である

## 決定

- 原則として，同じ `asset` に対する同じ `actionKind` の未完了 job は 1 つまでとする
- `queued` または `running` の job がすでに存在する場合，同じ `asset` と同じ `actionKind` の新しい job を追加してはならない
- `asset` が要 action 状態であることは，新しい job 生成の必要条件ではあるが，十分条件ではない
- `acquired_fingerprint === null` であることだけでは，同じ `asset` に対する同種 job の再生成を許容しない
- `observed asset fingerprint` が前回から変化していない場合，同じ `asset` に対する同種 job の再生成を許容しない
- 同じ `asset` に対する同じ `actionKind` の新しい job 生成を許容するのは，既存 job が terminal であり，かつ次のいずれかを満たす場合に限る
  - `asset` が新規作成された
  - `observed asset fingerprint` が変化した
  - 親 `content fingerprint` が変化した
  - 明示的な retry / rerun 操作が行われた
  - 既存 job が cleanup または失敗で終了し，policy 上あらためて job を作り直す必要がある
- [ADR-0017] の規則は，後続 action が必要な `asset` を識別する規則として維持する
- ただし [ADR-0017] の規則は，単独では新しい job instance の生成を許可する規則ではないと解釈する

## 影響

- job 作成箇所は，`asset` の要 action 判定とは別に，既存 job の状態と fingerprint 変化を見て重複生成可否を判断する必要がある
- `acquire-content` と `record-content` は，同じ重複 job 防止規則の上で扱える
- `record-content` だけの特例 dedupe は暫定策として扱え，将来的には一般規則へ寄せられる
- `assetIdsRequiringAcquire` のような命名は，「job を作るべき asset」と誤読しやすいため見直し対象になる

## 代替案

- `acquired_fingerprint === null` の asset には observe のたびに job を作り続け，scheduler や worker 側で毎回 dedupe する
  - job row が増殖し，後段 cleanup が正本ルールになるため採らない
- `record-content` だけ特例で observe 時 job 生成を抑止し，`acquire-content` は従来どおりにする
  - 問題の核が `record` 固有ではなく一般規則にあるため採らない
- `observed asset fingerprint` が一致していれば常に後続 action 不要とみなす
  - 未取得の新規 asset を取りこぼすため採らない
- 後続 job の重複防止は DB unique 制約だけで行う
  - retry や cleanup を含む状態遷移の理由を表現しにくいため採らない

## 参考資料

- [ADR-0017] ADR-0017: api backend は fingerprint に基づいて content と asset の登録規則を適用する
- [ADR-0051] ADR-0051: observed asset と record job cleanup は next-action policy で期限と非 action 理由を表現する

[ADR-0017]: ./0017-source-collector-upsert-based-on-identity.md
[ADR-0051]: ./0051-observed-asset-non-actionable-policy.md
