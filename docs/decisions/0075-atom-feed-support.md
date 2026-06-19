# ADR-0075: built-in `rss` / `podcast-rss` plugin は Atom feed を扱えるようにする

## ステータス

決定

## 範囲

`geshi-sdk`, built-in `rss` / `podcast-rss` plugins, `api backend`, `web ui frontend`

## コンテキスト

- `geshi` の source 登録導線は，URL を起点に source 候補を検出し，preview を確認してから登録する
- built-in `rss` / `podcast-rss` plugin は，feed 本体 URL の直接入力と，HTML の `link[rel=alternate]` からの候補発見の両方で使われる
- 現在の feed discovery HTML 処理は `application/atom+xml` を feed 候補として認識する
- 一方で，built-in `rss` / `podcast-rss` plugin の inspect / discover / observe は，実質的に RSS 2.0 と RDF を前提にしており，Atom の `<feed>` を parse できない
- その結果，Atom feed を配信する site では，HTML から候補 URL を発見できても，その後の inspect が失敗し，登録候補として提示されない
- built-in `podcast-rss` plugin の説明や test fixture には Atom への言及があるが，実装実態と一致していない
- feed 提供側から見ると，RSS ではなく Atom を公開するのは一般的な選択肢であり，source 登録時点で除外される理由は薄い
- Atom 対応を site ごとの特例 plugin で吸収すると，format 差分という共通論点を source 固有 plugin へ分散させることになり，built-in plugin の責務が不明瞭になる
- 一方で，Atom と RSS は entry / item，`updated` / `pubDate`，`summary` / `description`，link 表現，enclosure 表現などの shape が異なるため，単純な文字列置換ではなく plugin 契約上の正規化方針が必要である

## 決定

built-in `rss` / `podcast-rss` plugin は，RSS / RDF に加えて Atom feed を first-class に扱う．

Atom は別 plugin に分けず，既存の built-in feed collector の入力 format として吸収する．

### built-in `rss` plugin

- built-in `rss` plugin は，RSS 2.0 / RDF に加えて Atom feed を inspect / discover / preview / observe できるようにする
- Atom feed を `rss` plugin が受理した場合は，`feed-entry` として既存 `rss` source と同じ domain vocabulary に正規化する
- Atom entry からの metadata 変換規則は plugin 実装内で一貫して管理する
- `rss` plugin の format 対応は source ごとの差し替えではなく，built-in 共通責務として扱う

### built-in `podcast-rss` plugin

- built-in `podcast-rss` plugin も Atom feed を inspect / discover / preview / observe できるようにする
- ただし `podcast-rss` plugin が受理する Atom feed は，podcast source として必要な情報を満たすものに限る
- `podcast-rss` plugin が Atom feed を受理した場合は，`podcast-episode` として既存の podcast domain vocabulary に正規化する
- built-in `podcast-rss` plugin の説明と実装実態を一致させる

### format 差分の扱い

- Atom と RSS の違いは，plugin 内で共通の内部表現へ正規化してから preview / observe / fingerprint 計算へ渡す
- format ごとの差分を frontend や route handler や service 層へ漏らさない
- host は source URL が RSS か Atom かを意識せず，plugin の inspect / discover / preview / observe 結果だけを扱う
- HTML 側の feed 発見ロジックは，Atom を候補として検出できる現行方針を維持する

### source 登録と互換性

- source 登録導線は，Atom feed を入力しても RSS feed と同様に候補検出と登録が成立することを目指す
- 既存 RSS / RDF source の登録経路と observe 結果の挙動は壊さない
- Atom 対応の追加によって既存 RSS / RDF source の fingerprint が変わらないようにする
- Atom entry の fingerprint 規則は，RSS / RDF の既存規則を流用できる範囲では流用し，不足する field は Atom 側の同等概念へ写像する

### 実装境界

- Atom 対応は built-in `rss` / `podcast-rss` plugin と，必要最小限の shared parsing helper の範囲で扱う
- Atom 対応のために source model や source 登録 API 契約を増やさない
- plugin manifest や plugin list API は，Atom 対応を別 plugin として表現しない

## 影響

- Atom feed を配信する site を，既存の source 登録導線から扱えるようになる
- feed discovery HTML と built-in collector の対応 format が一致し，「見つかるが登録できない」不整合が減る
- built-in `rss` / `podcast-rss` plugin は，format 正規化の責務をより明示的に持つことになる
- plugin test には，Atom feed を使った inspect / preview / observe / register 近傍の自動確認が必要になる
- Atom podcast feed の受理条件を曖昧にすると `rss` と `podcast-rss` の候補重複や誤受理を招くため，実装時に判定条件を明示する必要がある

## 代替案

- Atom 用に built-in `atom` / `podcast-atom` plugin を新設する
  - format 差分だけで plugin を分けると，利用者視点の選択肢が増える一方で，source 種別の意味と format の違いが混ざりやすいため採らない
- Atom 対応は `rss` plugin だけに入れ，`podcast-rss` は RSS 2.0 のままにする
  - `podcast-rss` の説明と実装の不一致が残り，Atom 形式の podcast source だけ登録失敗するため採らない
- HTML discovery から `application/atom+xml` を除外する
  - feed 発見側と collector 側の不一致は隠せても，Atom source 自体を扱えない制約が残るため採らない
- source ごとの plugin で Atom 対応を個別吸収する
  - format 差分という built-in 共通責務を site 固有 plugin へ分散させることになり，再利用性と説明可能性が下がるため採らない

## 参考資料

- [ADR-0011] ADR-0011: source クロールを plugin 境界で拡張可能にする
- [ADR-0016] ADR-0016: source collector plugin は content と asset の fingerprint を返す
- [ADR-0017] ADR-0017: api backend は fingerprint に基づいて content と asset の登録規則を適用する
- [ADR-0066] ADR-0066: source collector plugin に source discovery と preview の登録前 API を追加する
- [ADR-0067] ADR-0067: web ui frontend の source 登録フローを detect / preview / register に再構成する
- [ADR-0074] ADR-0074: RSS source ごとの fingerprint と detail 抽出は plugin コードで切り替える

[ADR-0011]: ./0011-source-crawl-plugin-responsibilities.md
[ADR-0016]: ./0016-source-collector-content-and-asset-identity.md
[ADR-0017]: ./0017-source-collector-upsert-based-on-identity.md
[ADR-0066]: ./0066-source-registration-detect-and-preview-plugin-api.md
[ADR-0067]: ./0067-web-ui-source-registration-detect-preview-flow.md
[ADR-0074]: ./0074-rss-source-specific-strategies.md
