# ADR-0024: Geshi 側 job model と永続化方針を定める

## ステータス

決定

## 範囲

`backend/`

## コンテキスト

- ADR-0023 により，Geshi 側 `job` と BullMQ 側 job の橋渡し方針は決まった
- ただし bridge job の payload や DB 更新の扱いは，Geshi 側 `job` model と永続化の詳細が見えないと詰めにくい
- 次に進むには，Geshi 側 `job` が何を持ち，どこまで永続化するかを整理したい

## 決定

- Geshi 側 `job` 本体は immutable に近い形で扱う
- `job` 本体には，job の定義に属する情報だけを持たせる
  - 何の job か
  - 対象 resource は何か
  - 入力 payload は何か
  - いつ作られたか
  - 実行開始条件は何か
- 状態，BullMQ 側 job との対応情報，開始・終了時刻，失敗理由のような変化しうる情報は `job event` 側で扱う
- BullMQ 側 job との対応情報は，Geshi 側 `job` 本体には持たず，`job event` 側で扱う
- 状態履歴と進捗履歴は分けず，単一の `job event` として扱う
- `job event` は少なくとも次の情報を持つ前提で整理する
  ‐ Geshi 側の job id
  - BullMQ 側の job id
  - ステータス（イベント名）
  - 発生時刻
  - 自由記述
- API の現在状態は `job event` の集約で得る
  - 集約結果を view として持つかどうかは，この ADR では決めない
- `job event` の自由記述には，job の種類や状態に応じた短い補足情報を入れる欄として扱う
  - スタックトレースや詳細な障害情報は入れず，通常のログ側へ記録する
- `job event` の順序は，まず状態遷移順を優先し，同じ状態内では BullMQ 側が申告する発生時刻で比較する
  - これにより，古い event の遅延到着による巻き戻りを防ぎやすくする

## 影響

- bridge job の payload 設計を具体化しやすくなる
- DB 更新処理や冪等性の議論を，仮定ではなく model に基づいて進められる
- job API と永続化の境界を後続で詰めやすくなる
- Geshi 側 `job` 本体を immutable に寄せやすくなる
- 状態変化と進捗変化を別構造に分けずに扱える
- BullMQ 側との対応情報を `job` 本体に混ぜずに済む
- `job` 本体を定義情報に絞り，現在状態は別層で扱いやすくなる
- API の現在状態は `job event` 集約を基準にできる
- `note` に過度な障害詳細を持ち込まず，短い要約として扱いやすくなる
- 古い event の遅延到着による巻き戻りを防ぎやすくなる

## 代替案

- `job` 自体を mutable にして書き換える
  - `updated_at` が何の変更を表すのか曖昧になりやすく，履歴も追いにくい
- 状態履歴と進捗履歴を別構造に分ける
  - 今の段階では過度に細かく，最小構成としては重い
- BullMQ との橋渡し実装を先に進める
  - payload や DB 更新の前提が曖昧なまま実装が先行しやすい
- job model を BullMQ 側に寄せて実装する
  - Geshi 側の API / 履歴参照 model と混ざりやすい

## 備考

- 本 ADR は Geshi 側 `job` model と永続化の整理を対象とする
- 具体的な DB 種類や migration の実装詳細は，必要に応じて別段で詰める

## 参考資料

- [adr-0011] ADR-0011 backend の永続化方針を定める
- [adr-0021] ADR-0021 backend のジョブ実行基盤を選定する
- [adr-0023] ADR-0023 Geshi 側 job から BullMQ への橋渡し方針を定める
- [job-model] docs/job.md
- [design-log-0024] Design log 0024 job model and persistence

[adr-0011]: ./0011-backend-persistence-policy.md
[adr-0021]: ./0021-backend-job-runtime-selection.md
[adr-0023]: ./0023-job-dispatch-bridge.md
[job-model]: ../job.md
[design-log-0024]: ../design-log/0024-job-model-and-persistence.md
