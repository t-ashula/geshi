# 0024 job model and persistence

## 位置づけ

この文書は，ADR-0024 で Geshi 側 `job` model と永続化方針を定めるにあたり，`job` 本体の持ち方と状態履歴の扱いを比較するための Design log である．

## 比較したい案

### 1. `job` 自体を mutable にして書き換える

概要:

- `jobs` の 1 レコードを持つ
- `status`，`progress`，`started_at`，`finished_at` などを更新していく

利点:

- 実装が単純
- 現在状態を返す API を作りやすい
- query が素直

懸念:

- 状態変化の履歴を後から追いにくい
- BullMQ event を取り込むときに，何がどの更新を引き起こしたかが見えにくい
- `updated_at` が何の変更を表しているのか曖昧になりやすい
- 冪等性や巻き戻し防止を，最新状態の上書きだけで吸収しにくい

### 2. `job` 本体と状態変化履歴を分ける

概要:

- `job` 本体は append-only に近い形で持つ
- 状態変化や進捗変化は別の履歴として積み上げる

利点:

- 状態変化を後から追いやすい
- immutable 方針に寄せやすい
- BullMQ event や bridge job の再実行と相性がよい
- `updated_at` の意味を job 本体に背負わせずに済む

懸念:

- 最新状態をどう返すかの整理が別途必要
- API や query では集約を意識する必要がある
- 実装の初期コストは少し上がる

## 現時点の見立て

現時点では，Geshi 側 `job` 自体は immutable に寄せたい．

理由:

- 既存の永続化方針では，できるだけ履歴を積み上げ，イミュータブルに保つことを基本にしている
- `job` の更新を mutable に寄せると，`updated_at` がどの変化を表すのかという疑問がついて回る
- BullMQ event と bridge job の組み合わせでは，状態変化を履歴として持つ方が後から追いやすい

したがって，方向としては次に寄せる．

- Geshi 側 `job` 本体は immutable に近い形で扱う
- 状態変化，進捗変化，結果反映は単一の `job event` として持つ
- 最新状態や API 向けの表現は，その上に組み立てる

## BullMQ 側 job との対応情報について

現時点では，BullMQ 側の retry や内部的な id の採番には踏み込みすぎない方がよい．

方向としては次を採る．

- 実行用 BullMQ job が enqueue された時点の `bullJob.id` を，`export` 相当の処理で Geshi 側へ戻す
- その対応情報は Geshi 側 `job` 本体には持たない
- `job event` 側で扱う

この整理にすると，

- Geshi 側 `job` 本体は immutable に寄せやすい
- BullMQ 側の retry や再投入の事情を，Geshi 側 `job` 本体へ直接持ち込まずに済む
- enqueue 時点でどの BullMQ job に対応したかは event として追える

## `job` 本体に最新状態を持たせるか

現時点では，`job` 本体には最新状態を持たせない方向がよい．

`job` 本体には，

- 何の job か
- 対象 resource は何か
- 入力 payload は何か
- いつ作られたか
- 実行開始条件は何か

のような，job の定義に属する情報だけを持たせる．

一方で，

- current status
- progress
- latest note
- bullId
- started / finished
- failure reason

のような変化しうる情報は `job event` 側に持たせる．

現在状態や API 向けの表示は，`job event` の最新を集約して得る前提にする．
集約結果を view として持つかどうかは実装の問題であり，この段階では扱わない．

## job event のイメージ

状態履歴と進捗履歴は分けず，単一の `JobEvent` として扱う方向がよい．

イメージ:

```ts
type JobEvent = {
  geshiId: string;
  bullId: string | null;
  occurredAt: string;
  status:
    | "registered"
    | "scheduled"
    | "queued"
    | "running"
    | "cancelling"
    | "succeeded"
    | "failed"
    | "cancelled";
  note: string;
};
```

`note` には，

- 進捗状況
- 補足メッセージ
- 異常終了時の理由

などを入れる想定にする．

ただし，`note` を完全自由にはしない．

- `failed` 時のスタックトレースや詳細な障害情報は `note` に入れない
- それらは通常のログや監視側に記録する
- `note` には，job の種類ごとに状態に応じた短い補足情報を載せる

つまり，

- 何をしているか
- どこまで進んだか
- なぜ止まったかの短い要約

を持つ欄として使う方向である．

## job event の順序付け

現時点では，`job event` の順序は次の基準で決めるのがよい．

1. 状態遷移の順序を優先する
2. 同じ状態内では，BullMQ 側が申告する発生時刻を比較する

つまり，

- `queued` より `running`
- `running` より `succeeded / failed / cancelled`

を優先し，同じ状態が複数ある場合だけ発生時刻で前後を判断する．

この整理にすると，

- 古い event が後から届いても，状態遷移の順序で巻き戻りを防ぎやすい
- 同じ状態の progress 更新や補足更新は，発生時刻で自然に新旧を判定しやすい

## まだ残っている論点

- なし
