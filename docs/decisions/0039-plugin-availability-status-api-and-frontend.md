# ADR-0039: source collector plugin の利用可否状態は API で公開し frontend に反映する

## ステータス

提案

## 範囲

`api backend`, `web ui frontend`, `plugin`

## コンテキスト

- [ADR-0037] では source collector plugin 一覧を backend API から frontend に公開する方針を定めている
- [ADR-0038] と後続の CLI / generate 方針では，external plugin の一部が利用不能でも，生成物全体が成立する限り app 全体は継続できる余地を持たせたい
- ただし backend 内部だけで unavailable を握りつぶすと，frontend からは「選べない理由」や「既存 source が失敗する理由」が分からない
- unavailable な plugin を一覧から完全に消すだけでは，障害調査や設定修正の導線が弱い
- plugin の実装詳細や内部例外をそのまま frontend へ露出するのは不適切である

## 決定

- source collector plugin の利用可否状態は backend API から公開し，frontend はそれを利用者へ反映する
- 個別 plugin の解決失敗は plugin 単位 failure として扱い，その plugin を unavailable にしてよい
- plugin 一覧 API は，候補一覧に加えて利用可否状態を返してよい
- frontend は利用可否状態に応じて，通常候補と利用不能候補を区別して表示してよい
- source 作成，inspect，observe，acquire などで unavailable plugin を参照した場合は，unknown plugin error とは別に明示的な失敗として返してよい

## 影響

- plugin 障害や設定不整合を利用者から観測しやすくなる
- source 登録前の UI と，既存 source 実行時の失敗表示の整合を取りやすくなる
- generate を部分成功で扱う余地を残せる
- 一方で，plugin 一覧 API と frontend 表示状態の設計が少し複雑になる

## 代替案

- unavailable plugin は API から完全に隠し，frontend には何も伝えない
  - 障害原因や設定不整合を利用者が認識しづらいため採らない
- plugin 一覧 API は現状のままにして，実行系 API のエラーだけで対応する
  - 実行前に状態を把握できず，source 登録時の UX が悪いため採らない
- backend の内部例外 message をそのまま frontend に出す
  - 実装詳細の露出が強すぎ，利用者向け表現として不安定なため採らない

## 参考資料

- [ADR-0037] ADR-0037: source collector plugin 一覧は backend API から frontend に公開する
- [ADR-0038] ADR-0038: source collector plugin の発見元と利用可否制御の境界を分ける
- [ADR-0041] ADR-0041: external plugin 用 install / generate CLI の責務を分ける
- [ADR-0042] ADR-0042: backend と worker は生成済み plugin registry module を import する
- [design-log-0038] ADR-0038: source collector plugin の発見元と利用可否制御の境界を分ける に対するメモ
- [acceptance-0009] Plugin Runtime Discovery And Activation

[ADR-0037]: ./0037-source-collector-plugin-list-api.md
[ADR-0038]: ./0038-runtime-plugin-discovery-and-activation.md
[ADR-0041]: ./0041-plugin-install-and-generate-cli.md
[ADR-0042]: ./0042-generated-plugin-registry-import-boundary.md
[design-log-0038]: ../design-log/0038-runtime-plugin-discovery-configuration-shape.md
[acceptance-0009]: ../acceptance/0009-plugin-runtime-discovery-and-activation.md
