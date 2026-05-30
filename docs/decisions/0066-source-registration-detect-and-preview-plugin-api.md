# ADR-0066: source collector plugin に source discovery と preview の登録前 API を追加する

## ステータス

決定

## 範囲

`geshi-sdk`, `api backend`, built-in `rss` / `podcast-rss` plugins

## コンテキスト

- 現在の source 登録前 plugin API は [ADR-0023] で追加した単一 `inspect` が中心であり，URL 正規化，title，description，slug 候補の補完を目的としている
- この `inspect` は単一 plugin・単一 source 候補を前提としており，任意 URL からの source discovery，複数候補返却，登録前 preview を表現しにくい
- [acceptance-0013] で目指しているのは，plugin 事前選択を外すこと自体ではなく，任意 URL を起点に source を検出し，必要なら複数候補を返して登録前に選べるようにすることである
- たとえば feed 自体の URL だけでなく，feed 一覧ページや HTML の `link[rel=alternate]` を含むページを入力として，1 件以上の source 候補を発見したい
- 現状の `supports()` は，既に候補 source URL が与えられたときの適合判定には使えても，任意 URL から source を発見する API としては不十分である
- 現状の built-in `rss` / `podcast-rss` plugin は，source 登録前に何が登録可能か，登録後にどのような content が収集されそうかを，利用者が登録前に判断できる形では返していない
- source 登録を URL 起点の discovery に寄せるには，host が plugin 候補を集めるのではなく，plugin 境界自体が URL から source 候補を発見できる必要がある
- 一方で，初手から external plugin 全般へ新契約対応を要求すると，移行範囲と互換性考慮が広がりすぎる

## 決定

- source collector plugin に，source 登録前 discovery / preview 用 API を追加する
- 今回の初期実装対象は built-in の `rss` / `podcast-rss` plugin とし，この 2 つで discovery / preview を成立させる
- host は，単一 `inspect` とは別に，任意 URL を入力として 0 件以上の source 候補を返す discovery API を持つ
- discovery API は，少なくとも次を返せるものとする
  - 登録候補の配列
  - 各候補に対応する `pluginSlug`
  - `sourceKind`
  - 正規化後 URL
  - title / description / slug 候補
  - 候補ごとの判定状態
  - preview 取得可否
- discovery 結果は 0 件，1 件，複数件のいずれも許容する
- 1 件に収束した場合でも，host はその候補を detect 結果として扱う
- backend の役割は，最終的な plugin の決め打ちではなく，plugin から返った source 候補を平坦化し，user が選べる候補集合として整えて返すことに置く
- backend は，候補の表示順整理や重複候補の整理を行ってよい
- preview API は，登録前に「何が取れそうか」を判断できる最小限の情報を返す
- preview は observe の完全代替ではなく，登録前確認に必要な縮約結果として扱う
- preview は plugin 契約または host orchestration により，上限件数と実行時間上限を持つ
- 現行の単一 `SourceMetadata` を返す `inspect` だけでは足りないため，登録前 plugin 契約は拡張を前提にする
- 契約拡張の具体形は，少なくとも次のいずれかを取りうる
  - `inspect` を source discovery と preview を含めて拡張する
  - `discover` と `preview` を新設する
- ただし契約の主語は，単一 source metadata ではなく登録候補集合として表現できるものに寄せる
- `supports()` は残すとしても，発見済み候補 source URL に対する補助的判定として扱ってよく，discovery の前提 API には置かない
- `supports()` を持たない plugin が残る期間は，host が後方互換のために既存 `inspect` 失敗を候補なしとして扱う余地を持つ
- 今回の完了条件は built-in `rss` / `podcast-rss` に対する成立であり，external plugin への全面適用は後続タスクで進めてよい

### discovery の責務

- 任意 URL を入力として 0 件以上の source 候補を発見する
- feed URL そのものだけでなく，feed 一覧ページや HTML の alternate link を含むページからも source 候補を抽出できる
- 候補ごとの source metadata を返す
- 単一 source 候補だけでなく複数候補を返せる
- host が user に提示できる登録候補集合を作る

### preview の責務

- user が登録前に「何が取れそうか」を判断できる最小限の情報を返す
- 少なくとも title，summary，publishedAt，asset 種別などの一部 content 断片を返せる形を目指す
- preview は observe の完全代替ではなく，登録前確認に必要な縮約結果として扱う
- preview 件数と実行時間には上限を持たせる

## 影響

- source 登録前の解釈ロジックを plugin 境界へ閉じ込めたまま，任意 URL からの source discovery と preview を扱える
- built-in `rss` / `podcast-rss` を起点に，URL 起点で複数候補を返しうる登録経路を実装して確認できる
- backend は discovery / preview を plugin 境界の上に組み立てる責務を持つ
- SDK と built-in plugin 実装には，登録前 discovery 用契約の見直しが必要になる
- 一方で，preview 実装コストと network 負荷制御の責務が増える

## 代替案

- 現行の `inspect` を単一候補のまま維持する
  - 任意 URL からの source discovery，複数候補，preview を十分に表現できないため採らない
- backend service が plugin を介さず直接 URL を解釈する
  - source 種別ごとの解釈ロジックが plugin 境界の外へ漏れるため採らない
- `supports()` を source discovery の前段絞り込み API として使う
  - 既に候補 source URL が与えられたときの適合判定には使えても，feed 一覧ページや HTML alternate link を起点に source を発見する責務には向かないため採らない
- 初手から built-in / external を問わず全 plugin の detect / preview 対応を完了条件にする
  - 契約移行と互換性考慮が広がりすぎ，今回の開発項目のスコープを越えるため採らない

## 参考資料

- [ADR-0011] ADR-0011: source クロールを plugin 境界で拡張可能にする
- [ADR-0023] ADR-0023: source collector plugin に source 登録前 inspect API を追加する
- [ADR-0033] ADR-0033: source collector plugin 契約を backend から分離した package に置く
- [ADR-0043] ADR-0043: 外部 plugin 開発のために plugin author 向け SDK 境界を分離する
- [acceptance-0013] Source Registration Detection And Preview

[ADR-0011]: ./0011-source-crawl-plugin-responsibilities.md
[ADR-0023]: ./0023-source-registration-inspect-plugin-api.md
[ADR-0033]: ./0033-source-collector-plugin-api-package-boundary.md
[ADR-0043]: ./0043-plugin-sdk-boundary-for-external-plugin-development.md
[acceptance-0013]: ../acceptance/0013-source-registration-detection-and-preview.md
