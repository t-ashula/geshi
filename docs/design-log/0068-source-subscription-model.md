# ADR-0068 / ADR-0069 に対する source subscription model メモ

## この段階で整理したいこと

- `user は source を subscription し，その subscription を collection で整理する` というモデルを，実装可能な粒度まで下ろす
- `subscription` を単なる中間 table として扱うか，主体 model として扱うかを見極める
- subscribe / unsubscribe の履歴をどう保持するかを，ADR ではなく実装設計メモとして残す

## 先に固定したい読み方

- `source`
  - user 固有資源ではない
  - 共有可能な収集対象である
- `subscription`
  - user がどの source を購読しているかを表す主体である
  - collection が整理対象としてぶら下がる先は source ではなく subscription である
- `collection`
  - user が自分の subscription を整理するための grouping 単位である

## いま気になっていること

- user がいつ source を subscribe したかを記録したい
- unsubscribe したことも記録したい
- 将来，再 subscription が起こりうる
- current state と event history を 1 つの列や 1 行だけで持つと，再購読や履歴照会が窮屈になりやすい

## 現時点で採る前提

- source 登録時に，その user に対する subscription も同時に発生する
- つまり，現在の register 操作は user 視点では subscribe を含む
- 将来 user が増えたときは，register 時に既存の source が見つかれば，新しい source を複製するのではなく，その source への subscription を作る形に寄せる

この前提により，register は次の 2 通りを取りうる．

- 新規 source を作成し，同時に subscription を作る
- 既存 source を再利用し，subscription だけを作る

user が触る操作名としては当面 register のままでもよいが，内部 model としては「source の確保」と「subscription の作成」を分けて考える．

## 現時点の有力案

### 1. subscription は主体 model として持つ

`subscription` は単なる `user_id + source_id` の join ではなく，独立した主体として持つ方がよい．

理由:

- `subscribed_at` のような購読単位属性を自然に持てる
- collection が source ではなく subscription を参照できる
- 同じ source を複数 user が購読しても，user ごとの差異を subscription 側へ閉じ込められる
- 将来，購読単位の表示名，enabled，priority，user 固有設定を持たせやすい

### 2. subscribe / unsubscribe は event として分ける

`subscription` の current state と，subscribe / unsubscribe の履歴は分けて持つ案が有力である．

イメージ:

- `subscriptions`
  - current state を表す主体
- `subscription_events`
  - `subscribed`
  - `unsubscribed`
  - 必要なら `resubscribed`

理由:

- 「現在購読中か」を見る query と，「過去に何が起きたか」を見る query の責務を分けられる
- `unsubscribed_at` 1 本だけより，再 subscription を表現しやすい
- 履歴保存要件を event 側へ寄せられる

## 現時点の関係案

- `user 1 - n subscription`
- `source 1 - n subscription`
- `subscription 1 - n subscription_event`
- `user 1 - n collection`
- `collection` は `subscription` を整理する

collection 所属については，少なくとも次の 2 案がある．

### 案 A: subscription は 1 つの collection に属する

- `subscriptions.collection_id`

良い点:

- Explorer 風 UI と相性がよい
- 実装が単純

気になる点:

- 将来，複数 collection 所属へ広げるときに schema を変えやすい

### 案 B: subscription と collection は関連 table で結ぶ

- `collection_subscriptions`

良い点:

- 複数所属や順序づけに強い
- 将来拡張しやすい

気になる点:

- 初期実装としては少し重い
- UI 要件が 1 フォルダ所属前提なら過剰かもしれない

## unsubscribe 時の扱いで未決なこと

### 1. unsubscribe では current relationship を外し，履歴は event へ残す

現時点では次を採る．

- unsubscribe では，current state としての subscription relationship は解除する
- subscribe / unsubscribe の履歴は `subscription_event` に残す
- 再 subscription 時は，新たな current relationship を作り，履歴側へ event を積む

この方針では，current state と履歴を明確に分ける．

- 「今購読しているか」は current relationship を見る
- 「いつ購読し，いつ解除したか」は event を見る

### 2. unsubscribe 時に collection 所属をどうするか

案:

- unsubscribe と同時に，その relationship にぶら下がる collection 所属も外す

別案:

- collection 所属を別履歴として残し，再 subscription 時に復元できるようにする

現時点では前者，つまり current relationship と一緒に collection 所属も外す方が，current model の整合は分かりやすい．
再 subscription 時に以前の整理状態を復元したいかは，別途 UI / domain 要件として詰める．

## この時点で ADR にまだ入れないこと

- `subscription` table の最終 schema
- `subscription_event.kind` の最終語彙
- collection 所属を 1:1 にするか n:m にするか
- unsubscribe 時に collection 所属を残すかどうかの最終判断
- event sourcing 的にどこまで寄せるか

これらは実装判断に近く，まずは design log で持つ．

## 現時点の暫定結論

- `subscription` は導入しないと model が整合しにくい
- `subscription` は中間 table より主体 model として扱う方が自然
- subscribe / unsubscribe の記録は event として分ける案が有力
- source 登録時には subscription も同時に発生する前提で考える
- 将来の register は，既存 source の再利用と subscription 作成を許す形が自然
- unsubscribe では current relationship を外し，履歴は event 側へ残す
- collection は source ではなく subscription を整理する
- 詳細 schema と current state / event の最終切り方は，実装直前にもう一段詰める
