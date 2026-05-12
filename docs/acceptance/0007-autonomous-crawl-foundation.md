# Autonomous Crawl Foundation

この開発項目では，登録済み `source` を対象とする継続クロールが自律的に回り，その結果が必要な後続 job まで含めて非同期に実行される基盤を受け入れ条件とする．

## 受け入れ条件

- `source` 単位の継続クロールを開始できる入口がある
- 継続クロールは source ごとに独立して有効 / 無効と実行間隔を持てる
- アプリ全体の設定を扱う管理用画面がある
- 継続クロールの scheduler は，対象 `source` に対して `observe-source` job を自律的に投入できる
- `observe-source` の結果に応じて，必要な後続 job が投入される
- 後続 job を実行する worker は，enqueue 時点の取得対象情報で動く
- 成功時は，`content` / `asset` / `asset snapshot` と job 状態が整合して更新される
- 失敗時は，job 状態と失敗理由が確認できる
- 既存の手動 `observe -> acquire` 経路は壊れない
- 関連する backend test が通る

## 確認方法

- 継続クロール対象の `source` を用意し，scheduler から `observe-source` job が投入されることを確認する
- 管理用画面からアプリ全体の設定を確認・変更できることを確認する
- `observe-source` の結果に応じて，必要な後続 job が投入されることを確認する
- 継続クロール後に，保存済み実体または `asset snapshot` が更新されることを確認する
- 失敗ケースで，関連 job が `failed` になり失敗理由が保持されることを確認する
- 既存の `observe-source` / `acquire-content` の test が通ることを確認する
