# Design Log xxxx

複数 `source` を横断して，同じ話題に関する `content` を束ね，Google News 的な topical digest として読めるようにするための比較メモ．

## この段階で先に決めたいこと

- topical digest を，同一 `source` 内 digest とは別機能として扱うこと
- 話題の束ね単位を何にするか
- 記事，録音，文字起こしのような異種 `content` をどう同じ土俵で比較するか
- clustering を online にやるか，定期 job でやるか
- cluster を UI 上でどう読ませるか

## 現時点の前提

- 既存の基本閲覧単位は `source -> content` である
- `content` には将来的に `summary`, `detail_body`, `transcript` など複数の読解材料がぶら下がりうる
- 同一 `source` 内での digest は，話題の重なりが弱く，有用性が低い可能性がある
- 一方で，source 横断で同じ話題を集めるなら，digest としての価値は出やすい
- ただし，これは単なる新着一覧や単純要約ではなく，「話題検出」と「近縁 content の束ね」が本体になる

## この機能で期待する価値

- 同じ出来事や論点について，複数 source の見方をまとめて追える
- 単なる時系列一覧ではなく，「何が話題になっているか」を先に把握できる
- 記事系 source だけでなく，transcript が得られた音声系 source も同じ話題面に寄せられる可能性がある

## 構成候補

### 1. `content` ごとに話題ラベルを 1 つ付ける

- 実装は比較的単純
- 一方で，複数話題を含む長文や番組回をうまく扱いにくい

### 2. `content` から話題表現を抽出し，近いもの同士を cluster 化する

- Google News 的な体験には最も近い
- 代表記事や代表要約も作りやすい
- 一方で，話題表現，類似判定，cluster の更新規則を決める必要がある

### この段階の考え

- まずは候補 2 を前提に考えた方がよい
- ただし第一弾では，全文理解よりも「短い summary / keywords / embedding 的表現を各 `content` から作る」段階を先に置く方が現実的

## 入力表現の候補

### 1. `content.summary` だけを使う

- 軽い
- ただし source 依存が強く，空や粗い summary では精度が落ちやすい

### 2. `transcript`, `detail_body`, `summary` のうち利用可能なものを優先順で使う

- source 横断で比較しやすい
- ただし長さや品質のばらつきを整える前処理が必要

### この段階の考え

- 初手は `transcript` -> `detail_body` -> `summary` の順で入力候補にするのがよい
- ただしそのまま比較に使うのではなく，先に「比較用の短い話題表現」を作るべき

## cluster 生成タイミングの候補

### 1. 新しい `content` 追加時に都度 cluster へ割り当てる

- 反映は早い
- 一方で，既存 cluster の見直しや再編成がやりにくい

### 2. 定期 job で未処理 `content` をまとめて cluster 化する

- 再計算，閾値調整，失敗再試行がしやすい
- 既存の job 指向にも合わせやすい
- 一方で，反映は少し遅れる

### この段階の考え

- 第一弾は定期 job の方が扱いやすい
- topical digest はリアルタイム性より整合性と調整しやすさを優先したい

## データモデル候補

### 1. `topic_cluster` 主体を新設する

- cluster 自体を安定した閲覧対象として扱いやすい
- cluster title, representative summary, time range を持たせやすい

### 2. digest content だけを作り，中間 cluster 主体は持たない

- 見た目は作りやすい
- 一方で，同じ cluster の再集約や代表差し替えが難しい

### この段階の考え

- topical digest では cluster 自体が主要概念になるので，`topic_cluster` 的な主体を持つ方が自然
- `topic_cluster_content_links` のような link で `content` 群を束ねる形が第一候補

## UI 候補

### 1. digest source の `content` として cluster ごとの記事を並べる

- 既存 browse 導線の再利用はしやすい
- 一方で，cluster と元 `content` の関係が表現しきれない可能性がある

### 2. topical digest 専用 view を持つ

- cluster 一覧，代表 item，関連 source 群を自然に見せやすい
- 一方で，新しい browse 導線が必要になる

### この段階の考え

- 初期は既存導線へ寄せたくなるが，長期的には専用 view の方が自然
- cluster は通常 `content` と違い，「複数 source の束」であることを UI で前面に出したい

## 実装順の候補

1. `new items inbox` で新着の可視化を先に作る
2. 各 `content` から比較用の短い話題表現を生成する
3. 定期 job で source 横断 cluster を作る
4. cluster ごとの代表 summary を作る
5. topical digest view を用意する

## 現時点の推奨

- `cross-source topical digest` は，同一 `source` 内 digest とは別機能として扱う
- 第一弾では，全文 clustering より先に `content` ごとの比較用表現を作る
- cluster 生成は定期 job ベースを第一候補にする
- データモデルは `topic_cluster` と `content` link を持つ方向で考える
- UI は最終的に専用 view を持つ前提でよいが，初期は既存 browse 導線への仮置きもありうる

## まだ残る論点

- 記事と transcript を同じ類似度空間へ載せられるか
- cluster の分割 / マージ / 消滅をどう扱うか
- 同じ話題でも温度感の違う `content` をどこまで同 cluster に入れるか
- 代表 `content` をどう選ぶか
- cluster title を自動生成するか，代表 summary だけで見せるか
- clustering の explainability をどこまで UI に出すか
