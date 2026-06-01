# ADR-0068: user が source を subscription し，その subscription を collection で整理できるようにする

## ステータス

決定

## 範囲

全体

## コンテキスト

- 現在の source 一覧はフラットな集合として扱われており，source 数が増えたときの整理手段が弱い
- `source.kind` や plugin 設定は収集上の分類であり，利用者が後から整理するための分類軸とは責務が異なる
- source 自体は共有可能な収集対象として扱いたく，利用者ごとの差異は source そのものではなく subscription 側へ寄せたい
- 利用者は自分が subscription している source を用途や関心単位でまとめ，順序づけ，あとから出し入れしたい
- 今回の UI 要件では collection 階層は 1 階層で足りるが，永続化構造まで 1 階層固定にすると将来拡張時に詰まりやすい
- 現状のフラットな source 一覧にも利用価値があり，collection 導入後も切り替えて併用したい

## 決定

user が source を subscription し，その subscription を collection で整理するための上位概念として `collection` を導入し，`source` 本体とも `subscription` とも別主体として扱う．

### collection を source / subscription と分ける

- `source` は継続収集対象の識別として維持する
- `subscription` は user がどの source を購読しているかを表す利用者境界の主体として扱う
- `collection` は利用者が subscription を整理するための grouping 単位として扱う
- source の収集種別や plugin 適用条件と，利用者による整理軸を混在させない

### collection 構造

- `collection` は独立した識別子を持つ
- `collection` は将来的な多階層化を妨げない構造を持つ
- 具体的には parent を持てる設計を許容する
- ただし今回の利用者向け UI と要件は 1 階層のみを対象とする

### source / subscription / collection の関係

- user は source を subscription する
- subscription は 1 つの source を参照する
- collection は user に属する subscription をまとめる
- collection への所属関係は source 本体の属性へ埋め込まず，subscription と collection の関連として持つ
- collection に所属していない subscription も正規の状態として扱う

### 順序

- collection 自体の表示順を保持できるようにする
- collection 内での subscription の表示順，または所属関係に付随する順序を保持できるようにする
- これにより drag and drop の結果を永続化できるようにする

### browse UI

- source 一覧には少なくとも 2 つの表示モードを持たせる
- 1 つは collection を前提にした Windows Explorer 風の 1 行表示とする
- もう 1 つは現状のフラット一覧に近い表示とする
- 利用者は UI 上で表示モードを切り替えられるようにする

## 影響

- backend は source 一覧 API に加えて subscription，collection，所属関係を扱う API / 永続化が必要になる
- frontend は browse 状態として表示モードと collection ベースの subscription 表示状態を扱う必要がある
- source 一覧の UI は collection 導入後もフラット表示を残すため，一括移行ではなく切替対応になる
- 今回の UI は 1 階層で成立させつつ，永続化構造は将来の多階層拡張を阻害しない前提で設計する必要がある

## 代替案

- `sources` に `folder` や `category` のような単一属性を直接追加する
  - 実装は軽いが，利用者ごとの差異，複数所属，順序，未所属，階層化に弱い
- tag 的な自由ラベルだけを追加する
  - 横断分類には向くが，Explorer 風の browse 体験や順序づけの基盤としては弱い
- collection 表示へ全面移行し，フラット表示を廃止する
  - UI は単純になるが，既存の一覧利用に対する後方互換性を落とす

## 備考

- 具体的なテーブル構成，API 形状，D&D イベント処理の詳細は別途設計する

## 参考資料

- [ADR-0005] ADR-0005 データモデルを主体テーブルと履歴テーブルで構成する
- [ADR-0027] ADR-0027 web ui frontend の browse state を URL に写す
- [Acceptance-0014] Acceptance-0014 Source Collections And Browse Layouts

[ADR-0005]: ./0005-data-model.md
[ADR-0027]: ./0027-web-ui-browse-state-routing.md
[Acceptance-0014]: ../acceptance/0014-source-collections-and-browse-layouts.md
