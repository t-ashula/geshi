# 0034 asset store abstraction

## 位置づけ

この文書は，`ADR-0034` の検討メモ置き場である．

## 用語の仮置き

- 従来の backend 中心の DB 側保存は，`BackendStore` と呼ぶ
- 実ファイルや本文の保存先 abstraction は，`AssetStore` と呼ぶ

## この論点を立てる理由

`AssetStore` を導入したい理由として，少なくとも次がある．

- 実ファイルをそのまま `BackendStore` に入れるのは扱いづらいので避けたい
- そもそも実ファイル自体を `import job` などで受け渡すのは現実的ではない
- かといってファイルパスのような形に寄せると，移植性と安定性に問題があり，frontend からも使いにくい

したがって `0034` は，

- 実データの保存を `BackendStore` から分離し
- import / API / frontend から扱いやすい参照の形に整理する

ための論点として扱う．

## 論点

### 1. `Asset` は何を表すか

まず，`Asset` model 自体が何を表すかをはっきりさせる必要がある．

少なくとも次を決める必要がある．

- `Asset` は，取得済み実データの domain / API 上の表現か
- `Asset` は，実データそのものではなく metadata と参照を主体にするか
- 実データの read は `Asset` model から直接行えるべきか
- `AssetStore` への参照を `Asset` が持つべきか

### 2. `AssetStore` は何を表すか

次に，`AssetStore` が何の abstraction なのかを決める必要がある．

少なくとも次を決める必要がある．

- `AssetStore` は，file system や S3 のような storage の抽象か
- metadata は `AssetStore` ではなく `Asset` model 側が持つのか
- `AssetStore` には少なくとも read / write が必要か
- delete を現時点で scope に入れるか

### 3. `BackendStore` とどう分けるか

`BackendStore` と `AssetStore` の責務境界も決める必要がある．

少なくとも次を決める必要がある．

- `Asset` metadata は `BackendStore` 側に置くのか
- 実データ本体は `AssetStore` 側に置くのか
- `AssetStore` の保存結果を `BackendStore` 側へどう書き戻すのか

### 4. `acquireEntry` worker との接続

`0032` では，`acquireEntry` worker が `AssetStore` を read / write してよい前提を置いている．

したがって，少なくとも次を決める必要がある．

- worker が `AssetStore` に書く単位
- worker が返す結果に何を含めるか
- backend write API へは何を渡すか

### 5. `AssetStore` の interface と露出範囲

最後に，`AssetStore` の最小インタフェースと，その結果を API / model からどこまで見せるかを決める必要がある．

少なくとも次を決める必要がある．

- `put` だけで足りるか
- `get` や `open` が要るか
- stream での read / write が要るか
- stream でない read / write が要るか
- 戻り値として何を返すか
  - store 内部 ID
  - path / key
  - media type
  - size
  - hash
- どこまでを `Asset` model に持たせるか
- どこまでを API から見せるか

## 現時点の見立て

### 1. `Asset` について

現時点では，次の整理でよい．

- `Asset` は，主に `AssetStore` への参照を持つ model とする
- `Asset` は，取得済み実データの metadata を主体とする
- 実データそのものは `Asset` model から直接は取れない
- 実データの read は `AssetStore` を通じて行う

したがって，`Asset` は

- 取得済み実データの domain / API 上の表現
- stable な参照と metadata の置き場

として扱うのがよい．

### 2. `AssetStore` について

現時点では，次の整理でよい．

- `AssetStore` は，file system や S3 のような storage の抽象とする
- metadata は `AssetStore` ではなく `Asset` model 側が持つ
- `AssetStore` には少なくとも read / write が必要
- delete は現時点では不要としてよい
- `audio` / `video` / `text` の実データ本体は一律 `AssetStore` に入れる
- podcast の RSS に収まる程度の小さい `text` まで `AssetStore` に入れるのはやや過剰だが，`import job` への影響を減らすために一律化を優先する

### 3. `BackendStore` との境界について

現時点では，次の整理でよい．

- metadata は `Asset` model として `BackendStore` 側に持つ
- そうでないと `Asset` を API や frontend から参照できない
- `AssetStore` への書き込みは基本的に job に任せる
- `BackendStore` は実データ本体の器にはしない
- `Asset` が存在するなら，対応する実体も `AssetStore` に存在する前提で扱う

### 4. `acquireEntry` worker との接続について

現時点では，次の整理でよい．

- `AssetStore` への書き込みは，`entry(id)` に紐づけた形で行いたい
- store 内のキー名は，ひとまず `uuidv7` のような衝突しにくいものを候補にする
- ただし，そのままだと人間にも file system 的にも扱いづらいので，キー設計は別途考える
- backend 側には，`AssetStore` で使ったキーをそのまま返す

### 5. `AssetStore` の interface について

現時点では，次の整理でよい．

- `AssetStore` は，完成済み asset を保存する abstraction として扱う
- 録画・録音中の streaming write は，`AssetStore` ではなく worker / runtime 側の責務とする
- frontend 向けの stream 配信は，`AssetStore` とは別論点として扱う
- したがって，現時点では `AssetStore` に stream write を必須とはしない
- `AssetStore` には，stream でない read / write があればよい
- key の形は，ひとまず `entries/{entryId[0:2]}/{entryId[2:4]}/{entryId}/{uuidv7}.{ext}` を第一候補にする
