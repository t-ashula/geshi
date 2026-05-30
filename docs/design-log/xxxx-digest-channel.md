# Design Log xxxx

前回から増えた `content` 群を定期的に要約し，その要約自体を 1 つの `channel` として読めるようにするための比較メモ．

## この段階で先に決めたいこと

- 「増えた entry」を何で判定するか
- 要約結果を既存 `content` の派生物として持つか，独立した閲覧単位として持つか
- 定期実行の責務を既存 scheduler に寄せるか，別 job に分けるか
- 要約結果を UI 上でどう読ませるか
- 元になった `content` 群との対応をどこまで保持するか

## 現時点の前提

- 既存の閲覧単位は `source -> content` であり，UI も `content` 一覧と detail を中心にしている
- `transcript` や `detail_body` は，`content` 配下の派生主体として増やす方針になっている
- 定期実行系としては，`periodic-crawl` と `recording-scheduler` がすでにある
- 今回の要約対象は，録音，文字起こし，記事など，`source kind` をまたいで増えうる
- 利用者が読みたいのは各 `content` の断片的 summary ではなく，「前回以降の増分を束ねた読み物」である

## 現時点の懸念

- 同一 `source` 内では，同じ話題について複数の `content` が増えるとは限らない
- 記事系 source でも，新着を束ねても単なる目次や一覧に近くなりやすい
- ラジオや配信では，各回が独立した内容を持つことが多く，複数回を 1 本の digest にまとめても有用性が低い可能性が高い
- そのため，「増えたものを束ねて要約する」だけでは，読み物としての価値が弱く，summary 生成コストに見合わないおそれがある
- source 横断で同話題を束ねる `cross-source topical digest` は別の価値を持つが，これは本 log とは別機能として扱う

## 「増えた entry」の判定候補

### 1. `publishedAt` 基準で判定する

- 利用者の認知する公開時刻には近い
- 一方で，遅れて収集された古い entry や backfill を取りこぼしやすい

### 2. `collectedAt` 基準で判定する

- `geshi` が前回以降に新しく取り込んだものを素直に拾いやすい
- backfill や遅延取得にも強い
- 一方で，利用者が見る公開順とずれることはある

### この段階の考え

- 初手は `publishedAt` ではなく `collectedAt` 基準が素直
- digest の意味を「世の中で新しかったもの」より「前回からこの archive に増えたもの」に寄せる
- 後で必要なら表示順だけ `publishedAt` 優先に寄せる余地を残す

## 要約結果の持ち方の候補

### 1. 各 `content` に digest summary を派生主体としてぶら下げる

- 既存 `content` 派生モデルには乗せやすい
- 一方で，利用者が読みたい「増分を束ねた 1 本の読み物」にはなりにくい

### 2. 内部用の `source` を 1 つ作り，digest をその `source` の `content` として持つ

- 既存の browse / detail 導線に自然に乗せやすい
- 要約結果それ自体を「読める channel」として扱いやすい
- 一方で，通常 source と内部生成 source をどう区別するか整理が必要

### 3. 独自の `digest` 主体と専用 UI を新設する

- 専用機能としては分かりやすい
- 一方で，既存の `source` / `content` 閲覧導線を再利用しにくい

### この段階の考え

- 要件上は候補 2 が最も自然だが，そもそも digest 自体が十分有用かは再検討が必要
- 現時点では，digest channel を第一候補として実装着手するには根拠が弱い
- もし進めるなら，元 `content` 群は別途 link テーブルや参照情報で追えるようにするのがよい

## 定期実行の責務分担候補

### 1. `periodic-crawl` の中でそのまま digest 生成まで行う

- scheduler を増やさずに済む
- 一方で，crawl 対象選定と digest 生成責務が混ざる

### 2. digest 用 scheduler job が対象を走査して，個別の digest 生成 job を投入する

- 既存の `periodic-crawl -> observe-source` と同じ責務分離に寄せられる
- 再実行，失敗追跡，対象範囲の見直しを job 単位で扱いやすい
- 一方で，job 種別は増える

### この段階の考え

- 既存の scheduler 方針に合わせて，digest も scheduler と生成 job を分ける方が素直
- crawl と summary 生成は関心が違うので，同一 worker に押し込めない方がよい

## 要約入力の粒度候補

### 1. `content.summary` だけを束ねて要約する

- 実装は軽い
- 一方で，summary が薄い source では情報量が足りない

### 2. `transcript`, `detail_body`, `summary` のうち利用可能なものを優先順で使う

- source kind をまたいで比較的安定した入力を作りやすい
- 一方で，どの派生物を正本と見るかの優先順位整理が必要

### この段階の考え

- 初手は `transcript` -> `detail_body` -> `summary` の優先順がよさそう
- ただし transcript 全文をそのまま流し込むと重いので，事前の切り詰めや抜粋規則は必要

## UI の見せ方の候補

### 1. 通常 source と同じ一覧に digest source を混ぜる

- 既存導線に乗る
- 一方で，通常 source と内部 source の区別がつきにくい

### 2. digest 専用 source として sidebar / source list から辿れるようにする

- 「読む channel」であることを保ちつつ，通常 source と区別しやすい
- 第一弾としてはこれが分かりやすい

### この段階の考え

- 第一弾は digest 専用 source を明示的に分けて出す方が安全
- digest content を開いた detail では，要約本文に加えて元 `content` への参照一覧も欲しい

## digest 以外の候補

### 1. `new items inbox`

- 要約ではなく，「前回から増えた `content`」を読みやすく並べる
- 各 item には短い preview だけを付ける
- source 横断でも source ごとでも成立しやすい

### 2. `per-content enrichment`

- 複数 `content` を無理に 1 本へ束ねず，各 `content` の transcript / summary / key points を改善する
- ラジオや配信のように各回の独立性が強い source に向いている

### 3. `cross-source topical digest`

- 同じ話題を source 横断で束ねる
- digest としての価値は最も出やすい
- 一方で topic clustering や重複判定が必要で，別機能として扱う方がよい

## 現時点の推奨見直し

- まずは digest channel を第一候補にしない
- 先に `new items inbox` のような「新着を見落とさず判断しやすくする」導線を検討する
- 音声系 source では，複数回をまとめる digest より `per-content enrichment` を優先する
- 真に digest 的な価値を狙うなら，同一 source 内要約ではなく `cross-source topical digest` を別途検討する

## digest をやるなら暫定の置き方

- 増分判定は `collectedAt` 基準を第一候補にする
- 要約結果は，各 `content` の派生 summary ではなく，「内部 source に属する digest content」として持つ
- 定期実行は，digest scheduler と digest generation job に分ける
- digest 本文は 1 本の読み物として保持し，既存の `content detail` 導線で読めるようにする
- 元 `content` 群との対応は，少なくとも後から辿れるように保持する

## まだ残る論点

- digest source を 1 つだけ持つか，source ごとに digest source を分けるか
- digest の実行間隔を app 全体設定に置くか，source 群ごとの設定を持つか
- 要約入力の上限件数，文字数，source 混在時の並び順をどうするか
- transcript 未生成の audio 系 source を digest でどう扱うか
- digest 本文の format を `html` / `markdown` / `plain` のどれで持つか
- digest 生成失敗時に空振り回として残すか，何も作らないか
