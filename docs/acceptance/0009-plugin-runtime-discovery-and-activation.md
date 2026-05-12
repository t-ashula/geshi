# Plugin Runtime Discovery And Activation

この開発項目では，`backend` が外部 source collector plugin package を直接 source import で固定参照せず，運用時設定，plugin 用 CLI，生成済み registry module を通じて利用可能にし，`geshi` 全体設定ではその利用可否を制御できる状態を作ることを受け入れ条件とする．

## 受け入れ条件

- `backend` の source collector plugin registry 構築が，特定の外部 plugin package 名の静的 import に依存しない
- built-in plugin と外部 package plugin を，同じ plugin definition 契約で registry へ登録できる
- 外部 package plugin の依存宣言を，本体 `package.json` とは独立した運用時設定として定義できる
- 運用時設定は，plugin 用依存宣言として `package.json` の `dependencies` 相当の表現力を持てる
- plugin の install と generate が，独立した CLI 責務として定義されている
- `backend` と plugin worker が，共通の生成済み registry module を用いて一貫した plugin 集合を扱える
- `geshi` 全体設定は，「利用可能になった plugin のうちどれを利用対象とするか」を表せる
- 全体設定は plugin package 名ではなく `pluginSlug` などの論理識別子で plugin 利用可否を扱う
- source 登録 UI や source 作成 API が参照する plugin 一覧は，生成済み plugin 集合と全体設定で有効化された plugin を対象にできる見通しがある
- plugin の unavailable や設定不整合の情報を，backend API と frontend UI にどう反映するかが文書化されている
- source ごとの collector setting と，アプリケーション全体の plugin 有効化設定の責務境界が文書化されている
- plugin の install 先を，本体依存集合と分離できる見通しがある
- plugin 発見と有効化の仕組みを導入しても，既存 built-in plugin と既存外部 plugin package を同じ registry 経路で共存させられる見通しがある
- 実装時に必要な backend / worker / 設定管理の test 観点が整理されている

## 確認方法

- plugin 発見元を運用時設定に置く理由と，DB 全体設定に置かない理由が ADR で説明されていることを確認する
- plugin 設定形式が，本体 `package.json` と独立した設定として ADR で説明されていることを確認する
- plugin の install と generate を分ける理由が ADR で説明されていることを確認する
- `backend` と worker が生成済み registry module を import する方針が ADR で説明されていることを確認する
- 全体設定が plugin package 名ではなく論理識別子を扱う理由が ADR で説明されていることを確認する
- plugin 一覧 API や source 作成系が，利用不能 plugin をどう扱うかが ADR で説明されていることを確認する
- plugin 状態の API 表現と frontend での表示方針が ADR で説明されていることを確認する
- install failure，generate failure，設定不整合，未知 `pluginSlug` に対する失敗モードが ADR に明記されていることを確認する
