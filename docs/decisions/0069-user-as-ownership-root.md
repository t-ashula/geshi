# ADR-0069: source 整理機能に先立って user を所有主体として導入する

## ステータス

決定

## 範囲

全体

## コンテキスト

- `collection` を導入すると，subscription や全体設定を誰のものとして扱うかという所有境界が露出しやすくなる
- 現在の実装には `app_settings.profile_slug` があるが，これは全体設定の識別子であり，source や browse 整理の所有主体としては明示されていない
- source と subscription と collection を user 境界なしで追加すると，後から複数利用者や所有権境界を導入するときに table 関係や API 契約の見直し範囲が広がる
- 一方で，現時点の product / UI 要件は単一利用者として成立してよく，直ちに認証や権限制御まで必要としているわけではない
- 将来的に billing / plan の意味での subscription のような契約主体やプラン境界を導入する可能性があり，所有主体である user や source 購読関係としての subscription と混同しない前提を先に置きたい

## 決定

source 整理機能に先立って，`user` を subscription / collection / 全体設定の所有主体として導入する．

### user の位置づけ

- `user` は利用者資源の親主体とする
- subscription，collection，全体設定，今後の利用者固有設定は user に所属させる
- source は user 固有資源ではなく，共有可能な収集対象として扱う
- 今回の導入目的は ownership 境界の明示であり，認証機構の追加そのものではない
- `user` は billing / plan の意味での subscription や課金プランの代替概念としては扱わない

### 現時点の利用形態

- 当面の UI と運用は単一 user 前提で成立してよい
- ただし永続化構造，repository，service，API は user 概念を欠落させない
- 初期導入では default user のような単一主体を用意してもよい
- 認証，認可，billing / plan の意味での subscription，請求，プラン制御は後続設計として分離する

### source / subscription / collection の関係

- user は source を subscription する
- source に対する user ごとの関係は subscription として表現する
- collection は source ではなく subscription を整理する
- source 購読関係としての subscription は user に所属する

### billing / plan subscription との関係

- billing / plan の意味での subscription は，将来必要なら user に関連づく契約主体または利用条件主体として別概念で導入する
- source や collection の ownership を billing / plan subscription に直接ぶら下げない
- 今回の user 導入は，将来 billing / plan subscription を追加するときにも ownership と契約条件を分けて扱えるようにするための前提とする

### 既存 `profile` との関係

- `app_settings.profile_slug` は，将来的には user にひもづく全体設定識別の一部として再整理する
- 新規設計では `profile` を user の代替概念として拡張しない
- user 導入後は，subscription / collection と全体設定の ownership 表現を揃える方向で進める

### collection との関係

- collection は user に所属する
- subscription も user に所属する
- collection への所属は，同一 user 配下の subscription どうしの関係として扱う

## 影響

- DB schema は source に加えて，subscription や collection の親主体として user を表現する必要がある
- backend API は現在の単一利用者運用を保ちながらも，内部では user 境界を意識した実装へ寄る
- `app_settings` と今後の browse / organization 系機能の ownership 境界を subscription / collection 単位まで含めて段階的に揃えやすくなる
- 認証や権限制御を後から追加するとき，資源所有モデルを再定義する負担を下げられる
- billing / plan subscription を後から追加するとき，ownership と契約条件の責務を分けて設計しやすくなる

## 代替案

- 今回は collection だけ入れ，user や source subscription は後回しにする
  - 初期実装は軽いが，ownership 境界の後付けコストが増える
- `profile` をそのまま user 相当へ拡張する
  - 既存実装との接続はしやすいが，全体設定識別と資源所有主体が混ざりやすい
- 認証導入まで user を一切入れない
  - 当面は単純だが，subscription / collection / settings の親主体が曖昧なまま残る

## 備考

- この ADR は user を ownership root として導入する判断を定めるものであり，認証方式，session，権限モデルまでは定めない
- source 購読関係としての subscription の具体 schema や API 形状，billing / plan subscription や請求モデルも本 ADR では定めない

## 参考資料

- [ADR-0030] ADR-0030 定期実行クローラの設定は source ごとの設定から分けて管理する
- [ADR-0068] ADR-0068 user が source を subscription し，その subscription を collection で整理できるようにする
- [Acceptance-0014] Acceptance-0014 Source Collections And Browse Layouts

[ADR-0030]: ./0030-configuration-management.md
[ADR-0068]: ./0068-source-collections-for-organization.md
[Acceptance-0014]: ../acceptance/0014-source-collections-and-browse-layouts.md
