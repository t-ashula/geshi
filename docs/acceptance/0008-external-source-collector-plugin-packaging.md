# External Source Collector Plugin Packaging

この開発項目では，source collector plugin を `backend` 内部実装から外部 package として扱えるようにし，その成立性を非 RSS の HTML page を source 化する sample plugin で確認できることを受け入れ条件とする．

## 受け入れ条件

- `backend` が source collector plugin の契約を，自身の内部実装詳細から切り離された公開境界として扱える
- source collector plugin の公開契約が，外部 package から参照できる単位で提供される
- `backend` は標準 plugin 実装を内蔵前提にせず，外部 package として提供される plugin を registry 経由で解決できる
- plugin 契約には，少なくとも `inspect`，`observe`，`acquire`，`pluginSlug`，互換性確認に必要な version 情報が含まれる
- plugin 固有 config と backend 側の source / collector setting / job 実行境界の責務分担が文書化されている
- `podcast-rss` を含む既存 plugin を，外部 package 化された構成へ移せる見通しが文書で説明されている
- 非 RSS の HTML page を source として扱う sample plugin package を追加できる設計になっている
- sample plugin は，HTML document を取得して source metadata を解釈し，page 内の更新単位を `content` 候補として返す方針が定義されている
- sample plugin の対象として，`go-jp-rss` 相当のページ収集 plugin を追加する方針，責務，制約が文書化されている
- 実装時に必要な backend test と plugin package test の観点が整理されている

## 確認方法

- plugin API をどの package が所有し，`backend` と plugin package がどう依存するかを ADR で確認する
- registry が plugin 実装一覧の静的 import に閉じず，外部 package 登録を受けられる設計になっていることを ADR で確認する
- sample plugin の `inspect` / `observe` / `acquire` が，どの HTML 入力をどう解釈して何を返すかを ADR で確認する
- 非 RSS HTML source を扱う際に，source metadata，content identity，asset identity，取得対象 URL をどこで決めるかが ADR に明記されていることを確認する
- 既存 `podcast-rss` plugin の移行手順と，移行後も既存 source crawl 経路を壊さないことが受け入れ条件と ADR の両方で説明されていることを確認する
- 実装着手前に，この開発項目の終了条件が acceptance と ADR 群だけで追跡できることを確認する
