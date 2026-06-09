# ADR-0070: source collector plugin に継続的な source 検知 API を追加する

## ステータス

決定

## 範囲

`geshi-sdk`, `api backend`, `worker`, source collector plugins

## コンテキスト

- 現在の source collector plugin 契約には，既知 `source` を観測する `observe` と，登録前に候補を見つける `discover` / `preview` がある
- [ADR-0066] の `discover` は，web ui frontend の source 登録時に任意 URL から候補を出すための API であり，人がその場で入力して選ぶ経路を前提としている
- 一方で，音泉のように「既知 `program` の新着回」は通常クロールで分かっても，「新しい `program` 自体が増えた」ことは既知 `source` の `observe` だけでは検知できない
- こうした新規 `source` の発見は，単発の登録時補助ではなく，catalog / index / listing を継続的に走査して未登録候補を見つける責務として扱いたい
- この責務を既存 `observe` に混ぜると，既知 `source` の content 観測と未知 `source` の発見が同じ API に混在する
- 既存 `discover` をそのまま定期実行 API として流用する案もあるが，登録前 UX 向け契約と機械実行向け契約では，責務，state，失敗時の意味，出力の安定性が異なる
- 継続的な source 検知では，対象 listing ごとの継続状態を持てること，既知 source との突き合わせ前の raw な候補集合を返せること，preview を前提にしないことが重要である

## 決定

source collector plugin に，既知 `source` の `observe` と登録前 UX 向け `discover` とは別に，継続的な source 検知用 API を追加する．

### API の位置づけ

- 新 API は，catalog / index / listing のような「source 候補を列挙できる入力」から，0 件以上の source 候補を返す
- この API は，人が登録時に叩く補助 API ではなく，worker からの定期実行を主目的とする
- `observe` が既知 source の content 候補を返す API であるのに対し，新 API は未知 source の候補集合を返す API として分ける
- `discover` / `preview` は引き続き登録前 UX 用 API として残し，新 API の代替にはしない

### API の責務

- 入力 URL が表す listing / catalog / index を取得し，そこから source 候補を抽出する
- 各候補について，少なくとも `pluginSlug`, `sourceKind`, 正規化後 URL, title, description, sourceSlug 候補を返せるようにする
- 候補は 0 件，1 件，複数件のいずれも許容する
- plugin は必要に応じて，次回実行に使う継続状態を input として受け取り，output として返してよい
- host は，plugin が返した継続状態の意味を解釈せず，対象 listing ごとに保持と受け渡しだけを担う

### 継続状態

- 継続的な source 検知には，listing ごとの cursor, page continuation, last seen marker などを持ちたくなる
- この state は source collector plugin の通常 `collectorPluginState` には載せない
- なぜなら通常 `collectorPluginState` は既知 `source` にひもづく state であり，未知 `source` 検知対象とは ownership が異なるためである
- したがって新 API は，検知対象ごとに独立した detector state を受け取り，必要なら更新後 state を返せる契約にする

### host 側との責務分担

- plugin は source 候補の抽出までを担う
- host は少なくとも次を担う
  - 対象 listing ごとの実行
  - detector state の保持
  - 既存 source との dedupe
  - 検知結果の保存または後続処理への受け渡し
- plugin は source を自動登録しない
- source の自動登録，保留，承認待ち，通知などの policy は host 側で決める

### `discover` との関係

- `discover` は，任意 URL からその場で登録候補を見つける登録前 UX 向け API として残す
- 新 API は，定期実行，継続状態，既知 source との差分検知を前提とする機械実行向け API とする
- 同じ plugin が両方を実装してもよいが，契約上は別 API として扱う

### データモデル

- 継続的な source 検知を UI や後続 policy と整合させるため，少なくとも次の概念を `source` と別に持つ
  - `source detection target`
    - どの listing / catalog / frontier URL を定期走査するか
  - `detected source candidate`
    - 検知により見つかったが，まだ `source` に昇格していない候補
- `source detection target` は，対象 URL，pluginSlug，実行間隔，有効 / 無効，plugin 固有 config を持てるようにする
- `detected source candidate` は，plugin が返した候補を host が保持する主体であり，少なくとも `pluginSlug`, `sourceKind`, 正規化後 URL, title, description, sourceSlug 候補，status，検知時刻群，既存 `source` との解決結果を持てるようにする
- `detected source candidate` は `source` 本体とは別主体として扱い，不採用，duplicate，保留といった状態を正規状態として持てるようにする
- source への自動登録や承認登録は，`detected source candidate` から `source` への昇格として扱う
- table 構成や履歴保持の詳細は [design-log-0070] と [data-model] に分けて整理する

## 影響

- `geshi-sdk` は，source collector plugin に継続的な source 検知 API と detector state の入出力型を追加する必要がある
- backend / worker は，既知 source 用 crawl state と，listing ベースの source 検知 state を別 ownership で扱う必要がある
- 音泉のような catalog 型 source で，新しい `program` の追加を既知 `source` の observe と切り分けて扱える
- 一方で，検知対象の永続化モデルと，検知結果をどう user に見せるか，あるいは自動登録するかは別途設計が必要になる

## 代替案

- 既知 `source` の `observe` に未知 `source` の列挙も持たせる
  - content 観測と source 発見の責務が混ざるため採らない
- [ADR-0066] の `discover` をそのまま worker から定期実行する
  - 登録前 UX 向け契約と機械実行向け契約が混ざり，継続状態や failure semantics も曖昧になるため採らない
- host が plugin を介さず listing page を直接読んで source 候補を解釈する
  - source 種別ごとの知識が plugin 境界の外へ漏れるため採らない

## 備考

- API 名称は実装時に詰めてよいが，少なくとも `discover` / `observe` とは別名にする
- detector state の永続化先は，本 ADR では table 名や schema まで固定しない

## 参考資料

- [ADR-0011] ADR-0011: source クロールを plugin 境界で拡張可能にする
- [ADR-0033] ADR-0033: source collector plugin 契約を backend から分離した外部 package として定義する
- [ADR-0035] ADR-0035: plugin 固有の継続状態は collector setting とは分けて backend が保持する
- [ADR-0066] ADR-0066: source collector plugin に detect / preview 向け登録前 API を追加する
- [ADR-0064] ADR-0064: source をまたいで同じ pluginSlug で共有される実行時状態は source 状態と分けて host が保持する
- [design-log-0070] Design Log 0070
- [data-model] Data Model

[ADR-0011]: ./0011-source-crawl-plugin-responsibilities.md
[ADR-0033]: ./0033-source-collector-plugin-api-package-boundary.md
[ADR-0035]: ./0035-plugin-owned-state-storage.md
[ADR-0066]: ./0066-source-registration-detect-and-preview-plugin-api.md
[ADR-0064]: ./0064-plugin-global-runtime-state.md
[design-log-0070]: ../design-log/0070-source-collector-source-detection-api.md
[data-model]: ../data-model.md
