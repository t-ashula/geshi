# Design Log 0070

継続的な source 検知 API と，それを支えるデータモデル概念の補足メモ．

## 先に分けたい責務

- 既知 `source` の content 観測
- 登録前 UI での単発 detect / preview
- listing / catalog からの継続的な未登録 source 検知

この 3 つは近いが同一ではない．

- `observe`
  - 既知 `source` に対して `content` 候補を返す
- `discover`
  - 人が URL を入力した場で登録候補を返す
- 今回の新 API
  - worker が listing を定期走査して未登録 source 候補を返す

## なぜ `source` に直結しないか

継続検知の結果は，見つかった瞬間に `source` へ昇格するとは限らない．

正規状態として次がありうる．

- 候補として見つかったが未確認
- preview は見たが未登録
- 既存 `source` と重複していた
- 不要なので dismiss した
- policy 上は自動登録対象外

このため「未登録候補」を `source` と別主体で持たないと，UI と worker の状態遷移が表しづらい．

## 必要になる主体

### 1. `source detection target`

listing / catalog / frontier の走査対象．

最低限ほしい属性:

- `id`
- `userId`
- `pluginSlug`
- `sourceKind`
- `url`
- `enabled`
- `schedule`
- `config`
- `createdAt`

補足:

- これは既知 `source` そのものではない
- `collectorSetting` と同じ表ではなく，未知 `source` 検知専用の設定主体として分ける

### 2. `source detection state`

検知対象ごとの継続状態．

最低限ほしい属性:

- `id`
- `sourceDetectionTargetId`
- `pluginSlug`
- `state`
- `updatedAt`

補足:

- cursor, continuation token, last seen marker を置く
- `collectorPluginState` と混ぜない

### 3. `detected source candidate`

検知で見つかった未登録候補．

最低限ほしい属性:

- `id`
- `userId`
- `sourceDetectionTargetId`
- `pluginSlug`
- `sourceKind`
- `normalizedUrl`
- `sourceSlug`
- `title`
- `description`
- `status`
- `fingerprint`
- `rawMetadata`
- `firstDetectedAt`
- `lastDetectedAt`
- `lastPreviewedAt`
- `resolvedSourceId`

## `detected source candidate.status` の候補

少なくとも次を考える．

- `detected`
- `previewed`
- `registered`
- `dismissed`
- `duplicate`

補足:

- `registered`
  - この candidate から `source` を作った
- `duplicate`
  - 既存 `source` と同一と分かった
- `dismissed`
  - user または policy が候補として捨てた

## worker と UI のつながり

worker は `detected source candidate` を作る / 更新するだけに寄せる．

UI はこの候補を一覧し，

- preview
- register
- dismiss

を行う．

register 成功時には，

- `source`
- 必要なら `subscription`

を作り，candidate を `registered` に遷移させる．

## dedupe の考え方

同一候補の判定は URL だけでは不十分なことがある．

候補としては少なくとも次を材料にする．

- `pluginSlug`
- `sourceKind`
- 正規化後 URL
- `sourceSlug`
- plugin が返す fingerprint

host はこれらで既存 `source` と candidate 同士の両方を dedupe する．

## まだ決めていないこと

- candidate を履歴主体と current 主体に分けるか
- `status` 遷移を event として別 table に積むか
- preview 結果の cache を candidate に持つか別主体に持つか
- 自動登録 policy を worker 直結にするか別 job に分けるか
