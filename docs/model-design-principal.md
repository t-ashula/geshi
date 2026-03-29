# モデル設計の層分離原則

## 目的

モデル設計において、以下が混線しやすい。

- ドメインとして何が存在するか
- API / Protocol として何を公開・受け渡しするか
- 物理的にどのようなテーブル・カラムで保存するか

この混線を防ぐため、以降のモデル設計では **3つの層を明確に分離して考える** ことを原則とする。

---

## 3つの層

### 1. 概念モデル

概念モデルは、geshi において **何が存在するか**、また **それぞれがどのような責務と関係を持つか** を整理するための層である。

ここで扱うのは以下のような事項である。

- entity の意味
- entity 間の責務分担
- entity 間の関係
- 業務上・ドメイン上の区別
- 用語の定義

たとえば、

- `channel` は人間に提示される継続監視対象である
- `feed` は技術的なクロール・更新検知の単位である
- `source` は platform や由来の緩い分類であり、`channel` の親ではない

といった定義は概念モデルに属する。

概念モデルでは、表示都合や DB の都合を持ち込みすぎない。
たとえば `icon_asset_id` のような表現上の詳細や、nullable column の配置方針などは本質ではない。

### 2. API / Protocol モデル

API / Protocol モデルは、**外部にどのような契約で公開・受け渡しするか** を定義する層である。

ここで扱うのは以下のような事項である。

- API レスポンスやリクエストの shape
- worker 間・サービス間でやりとりする payload
- 各 field の型や必須性
- public contract としての安定性
- UI や他コンポーネントが依存してよい範囲

この層では、概念モデル上は本質ではない表示補助的な属性を含めてもよい。
たとえば以下は API / Protocol モデルでは妥当である。

- `description`
- `icon_url`
- `artwork`
- `search_tags`
- `display_name`

重要なのは、それらが **概念モデル上の本質である必要はない** ということである。

### 3. 物理モデル

物理モデルは、**実際にどのように保存・検索・更新するか** を定義する層である。

ここで扱うのは以下のような事項である。

- SQL テーブル設計
- column の分割
- attributes テーブルへの退避
- index
- nullable の扱い
- join 戦略
- read model / write model の分離
- factory や repository の背後にある永続化都合

物理モデルは、概念モデルや API / Protocol モデルと一致しなくてよい。
たとえば API では 1 つの `Source` オブジェクトとして見せつつ、物理的には以下のように分割してよい。

- `sources`
- `source_attributes`
- `assets`

重要なのは、物理モデルが public contract に漏れ出ないことである。

---

## 変化情報の分離原則

層分離とは別に，モデル設計では **定義情報** と **変化情報** をなるべく分けて考えることを原則とする。

これは，概念モデルの段階でも有効である。

重要なのは，「実装上その object を書き換えるかどうか」ではなく，

- その model 本体は何を表すのか
- 時間とともに変わる情報を本体に含めるのか
- 状態変化や履歴を別に寄せるのか

を意識して設計することである。

### 定義情報

定義情報とは，その model が何であるかを決めるための情報である。

例:

- 識別子
- kind
- 所属関係
- 作成時に決まる入力
- 実行開始条件

これらは，原則として model 本体に持たせる。

### 変化情報

変化情報とは，時間経過や処理進行に応じて変わる情報である。

例:

- current status
- progress
- 開始時刻
- 終了時刻
- 失敗理由
- 実行履歴

これらは，原則として event，履歴，集約 view など別の構造で扱うことを優先する。

### immutable 寄りに考える

したがって，概念モデルでは各 model を **immutable 寄り** に考える。

ここでいう immutable は，「一切更新しない」という意味ではなく，

- model 本体は定義情報を中心に持つ
- 変化情報は別の構造へ逃がす
- current state は必要に応じて履歴や派生 view から集約する

という設計姿勢を指す。

たとえば `job` と `job event` を分ける整理は，この原則の一例である。

### 概念モデルに入れるもの

以下のようなものは概念モデルに入れやすい。

- その entity の意味に関わるもの
- その entity の責務に関わるもの
- 業務ルールや振る舞いの判断に直接使うもの

例:

- `kind`
- `role`
- 所属関係
- 集約関係

### API / Protocol モデルに入れるもの

以下のようなものは API / Protocol に入れてよい。

- UI にとって有用な表示補助情報
- 他コンポーネントが必要とする field
- contract として安定させたい field

例:

- `description`
- `icon_url`
- `artwork`
- `display_title`
- `search_tags`

注意:

- `status` や `is_active` のような状態系の属性は，無条件にモデルへ入れるのではなく，その entity 自体の定義や責務に属する場合に限る
- 処理進行に応じて変わる current state や progress のような情報は，変化情報のモデル（履歴，集約）に寄せる方を優先する

### 物理モデルでのみ扱えばよいもの

以下のようなものは物理モデル側の関心である。

- どのテーブルに置くか
- attributes テーブルに逃がすか
- nullable column をどう分離するか
- index をどう張るか
- read model を別に持つか

例:

- `icon_asset_id` を本体テーブルに置くか attributes に置くか
- `description` を本体列にするか別テーブルにするか
- `search_tags` を array にするか別 table にするか

---

## 文書化ルール

上記 3 層を以下のように文書化する。

### ADR に書くもの

ADR には **概念モデルまで** を書く。

ADR で扱うのは、

- なぜその概念分割を採用するか
- 各モデルの責務をどう分けるか
- どの概念を親子にするか / しないか
- どの用語を採用するか
- 設計判断の理由と影響

である。

ADR では、原則として以下は書きすぎない。

- API field の詳細
- SQL の column 分割
- index 設計
- factory 実装の都合

ADR は **概念レベルの設計判断** を残すための文書とする。

ただし，「付録」として，API レベルの事柄や，テーブルレベルの詳細を書いて，その時点での実装の方向を記録しておくことも有用である．

### docs に書くもの

docs 以下の文書（とくに `docs/models.md`） には **API / Protocol レベルの詳細** を書く。

ここで扱うのは、

- 各モデルの field 定義
- 型
- 必須 / 任意
- 各 field の意味
- component 間で依存してよい contract
- protocol 上のオブジェクト shape

である。

実装上の依存は原則としてここまでとする。
すなわち、アプリケーションコード・サービスコード・メッセージングコードは、`docs/models.md` で表現されるモデル shape に依存してよい。

### 実装内部で扱うもの

SQL や factory より先では、**物理テーブルレベル** を基本とする。

ここでは、

- table 分割
- attributes table
- repository / DAO
- ORM model
- join / projection
- denormalized read model

などを扱う。

この層は内部実装であり、原則として public contract にはしない。
また、物理モデルの都合を直接 API / Protocol に漏らさない。

---

## 依存方向の原則

依存方向は次のようにする。

- ADR
  → 概念モデルを定義する
- `docs/models.md`
  → ADR の概念モデルを受けて API / Protocol モデルを定義する
- 実装
  → `docs/models.md` に定義された contract に依存する
- SQL / factory / repository の背後
  → 物理モデルに依存する

逆方向の漏れ出しは避ける。

特に避けるべきなのは以下である。

- 物理テーブル都合で概念モデルの意味が歪むこと
- ORM の都合で public contract が決まること
- nullable column の配置事情が API shape に直接現れること

---

## 具体例

### 例: `source`

#### 概念モデル

- `source` は外部由来や platform 種別を表す緩い分類である
- `channel` の親ではない

#### API / Protocol モデル

- `id`
- `key`
- `name`
- `is_active`
- 必要なら `description` や `icon_url`

#### 物理モデル

- `sources`
- `source_attributes`
- `assets`

のように分かれていてよい。

### 例: `channel`

#### 概念モデル

- `channel` は人間向けの継続監視対象である
- 複数の `feed` を束ねる

#### API / Protocol モデル

- `id`
- `title`
- `status`
- `entity_kind`
- `primary_subject_kind`
- 必要なら `artwork`, `search_tags`

#### 物理モデル

- `channels`
- `channel_attributes`
- `channel_search_index`

のように分かれていてよい。

### 例: `feed`

#### 概念モデル

- `feed` は技術的なクロール・更新検知の単位である
- 必ず 1 つの `channel` に属する

#### API / Protocol モデル

- `id`
- `channel_id`
- `source_id`
- `kind`
- `role`
- `url`
- `external_id`
- `crawler_kind`
- `status`

#### 物理モデル

- `feeds`
- `feed_runtime_state`
- `feed_auth_config`

のように分けてよい。

---

## 設計原則

新しいモデルを追加するときは、まず次の順番で考える。

1. そのモデルは概念として何者か
2. 外部 contract として何を公開する必要があるか
3. 物理的にどう保存するのが自然か

この順序を崩さない。

また、ある field を見たときには必ず次を確認する。

- これは概念上の本質か
- public contract として必要か
- 単に保存上の都合か

この問いにより、field をどの層で扱うべきかを判断する。

---

## 補足

この原則は、設計段階での思考整理だけでなく、以下の混線を避けるためのものである。

- 概念モデルと API shape の混同
- API shape と DB schema の混同
- ORM model をそのまま public contract にしてしまうこと
- UI 表示属性を概念上の本質だと誤認すること

geshi では、これらを避けるために、
**ADR = 概念モデル**、**`docs/models.md` = API / Protocol モデル**、**SQL / factory 背後 = 物理モデル**
という分担を採用する。
