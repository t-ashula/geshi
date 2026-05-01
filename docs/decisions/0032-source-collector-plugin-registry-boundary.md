# ADR-0032: source collector plugin 解決を registry interface 境界へ寄せる

## ステータス

決定

## 範囲

`backend`

## コンテキスト

- `backend` では source collector plugin を `getSourceCollectorPlugin(...)` で解決している
- 現状は service や worker がこの関数を直接呼ぶ箇所があり，unit test では module mock に頼りやすい
- [ADR-0031] により `backend` では interface 境界で依存を受け取り，Hono 依存や具体実装依存を外側へ寄せる方針を取っている
- plugin 解決が global function 直呼びのままだと，service / worker の testability と依存方向だけがその方針から外れる
- `source-inspect-service` だけを局所的に注入可能にしても，`observe-source` / `acquire-content` では同じ問題が残る
- そのため，plugin 解決責務を 1 箇所の抽象に寄せ，module mock ではなく fake 実装注入で test できる形に揃えたい

## 決定

- source collector plugin の解決は `SourceCollectorRegistry` の interface 越しに行う
- `getSourceCollectorPlugin(...)` のような global function を service / worker から直接呼ばない
- production では plugin map を持つ registry 実装を 1 つ用意し，composition root から注入する
- test では module mock を使わず，必要な plugin だけを返す fake registry を渡す

### interface の原則

- `SourceCollectorRegistry` は少なくとも `get(pluginSlug: string): SourceCollectorPlugin` を持つ
- service / worker は registry を受け取り，自分で plugin map や import を持たない
- registry 実装だけが plugin 実装の一覧や解決方法を知る

### 適用対象

- `source-inspect-service`
- `observe-source` worker
- `acquire-content` worker
- 将来 plugin 解決が必要になる backend 内の他コンポーネント

### test 方針

- service / worker test では `SourceCollectorRegistry` の fake 実装を注入する
- plugin の挙動自体を確認したい test だけが実 plugin 実装を直接 import する
- plugin 解決関数の module mock は原則として使わない

## 影響

- service / worker test が module mock ではなく通常の dependency injection で書ける
- plugin 解決責務が 1 箇所に集まり，依存方向が揃う
- plugin の追加や差し替え時に，解決ロジックの変更点が registry 実装へ閉じる
- composition root の依存配線は 1 段増える

## 代替案

- `getSourceCollectorPlugin(...)` をそのまま使い続け，test では module mock で対応する
  - 実装変更は少ないが，依存方向が global function に固定され，testability 改善の方針と合わないため採らない
- `source-inspect-service` など個別コンポーネントごとに resolver 関数だけ注入する
  - 局所改善にはなるが，plugin 解決の責務が散り，worker 側とも設計が揃わないため採らない

## 備考

- この ADR は plugin 実装そのものの責務ではなく，plugin をどう解決して依存注入するかを決める
- registry の public API は最小から始め，必要になるまで `list` や capability 判定は追加しない

## 参考資料

- [ADR-0011] ADR-0011: source クロールを plugin 境界で拡張可能にする
- [ADR-0031] ADR-0031: route handler のテスト容易性を interface 境界と Hono 依存の隔離で高める

[ADR-0011]: ./0011-source-crawl-plugin-responsibilities.md
[ADR-0031]: ./0031-route-handler-testability-through-interface-boundaries.md
