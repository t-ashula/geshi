# Design Log 0058

`content detail` における `detail_body` の表示方式，作り方，記録方法，および `summary` との役割分担に関する比較メモ．

## この開発項目で先に決めたいこと

- `content detail` で何を本文表示の主対象にするか
- 派生主体をどう作るか
- 派生主体をどう記録するか
- 抽出規則をどの境界に置くか
- `summary` と `html asset` 本文をどう共存させるか

## detail での表示候補

### 1. raw `html asset` をそのまま主表示する

- 保存済み asset の再利用だけで第一弾を成立させやすい
- 取得結果そのものを確認できる
- 一方で，見た目や安全性の制御は必要

### 2. `detail_body` を主表示する

- 読みやすくなりやすい
- `summary` より本文に近い情報を表示できる
- 一方で，生成方法と記録方法を別途決める必要がある

### 3. `summary` を常に主表示する

- 既存データだけで表示を成立させやすい
- 一方で，`html asset` から本文を得る意味が表示に反映されにくい

## 派生主体の作り方の候補

### 1. acquire の一部として同期生成する

- acquire 成功時点で本文表示に必要な `detail_body` まで揃う
- 一方で，acquire の責務と処理時間が重くなる

### 2. acquire 後の別 job で非同期生成する

- acquire と本文生成の責務を分けやすい
- 再生成や失敗追跡も job 単位で扱いやすい
- 一方で，detail 表示時に「まだ生成待ち」の状態を扱う必要がある

### 3. detail 表示時にオンデマンド生成する

- 保存前の派生主体を増やさずに済む
- 一方で，閲覧時 latency が増え，表示要求と生成責務が混ざりやすい

### この段階の考え

- 第一弾は `content detail` request の中で，必要時に `detail_body` を生成する形で進める
- UI は通常の非同期 fetch として扱い，応答が返ったら表示を書き換えるだけに留める
- 実際の抽出規則は，source collector plugin の `extractor(asset)` に置く方が source ごとの差分を閉じ込めやすい
- 一方で，request が重くなりすぎないかと，失敗時フォールバックを明確にする必要がある

## 抽出規則の置き場所の候補

### 1. backend core に持つ

- 実行経路は単純
- 一方で，source ごとの抽出差分が backend 本体へ漏れやすい

### 2. source collector plugin に `extractor(asset)` を追加する

- source ごとの差分を，既に source を知っている plugin 側へ閉じ込めやすい
- `detail_body` 生成時も，同じ source plugin を使って抽出規則を選べる
- 一方で，source collector plugin の責務は広がる

### この段階の考え

- `detail_body` 抽出は source ごとの差分が強いので，backend core に閉じるのは無理がある
- 専用非同期 job だけにすると UI は request 後の再取得前提になりやすい
- したがって，第一弾では `content detail` 要求時に同期生成を試みつつ，抽出規則自体は plugin の `extractor(asset)` に持たせるのが自然

## 派生主体の記録方法の候補

### 1. `asset` の派生 asset として持つ

- 元 `html asset` との由来を近くに置ける
- file artifact として保存しやすい
- 一方で，detail の主単位である `content` より asset 側に寄りすぎる

### 2. `content` に属する別主体として持つ

- `content detail` の表示主体として扱いやすい
- transcript と同様に，生成元 `asset snapshot` 参照を持つ形へ寄せやすい
- 一方で，新しい主体や API 表現を増やす判断が必要になる

### 3. `content.summary` を上書きする

- 表示上は単純
- 一方で，source 由来 summary と派生本文とが混ざり，履歴も由来も失いやすい
- この案は避けたい

### この段階の考え

- `asset(kind=generated)` のように既存 asset へ押し込めるより，派生物として専用モデルを持つ方が自然
- ただし，単一の `generated_assets` へ集約するのではなく，`content` 配下に種類ごとの兄弟主体を持つ方が，`transcript` とも整合しやすい
- `transcript` も例外ではなく，`content` 配下の派生主体の 1 つとして整理したい

## `summary` との役割分担

- `summary` は source が付与した概要であり，`content` のメタデータとして保持されている
- `html asset` は参照元本文であり，summary より詳細だが，source 側のノイズや装飾も含みうる

### 方向性 A

- `detail_body` があればそれを一次表示
- 無ければ `summary` を使う

### 方向性 B

- 常に `summary` を一次表示
- `detail_body` は補助情報へ下げる

### この段階の考え

- `detail_body` を作るなら，表示ではそれを優先したい
- ただし，`detail_body` が常に揃うとは限らないので，`summary` をフォールバックとして残すのが自然
- `summary` を上書きするのではなく，表示優先順位として扱う方が由来を保てる

## 現時点の推奨

- `content detail` では，`detail_body` があればそれを本文表示の優先対象にする
- `detail_body` が無ければ，`summary` をフォールバック表示に使う
- 元の `html asset` は参照元として辿れるように残す
- `detail_body` の生成は，第一弾では `content detail` request 内で必要時に行う形を第一候補にする
- 抽出規則は source collector plugin の `extractor(asset)` を第一候補にする
- 記録方法は，`content` に属する別主体としつつ，派生主体の種類ごとに専用モデルを持つ案が第一候補

## まだ残る論点

- `detail_body` モデルの最小属性を何にするか
- 派生主体ごとの専用モデルを，API 上でどこまで共通 envelope に寄せるか
- `content detail` request 内生成の上限時間をどこで切るか
- `extractor(asset)` の plugin interface をどこまで一般化するか
- `summary` が短すぎる場合に，`detail_body` 未生成でも別導線を出すか
