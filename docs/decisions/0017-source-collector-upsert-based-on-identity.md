# ADR-0017: api backend は fingerprint に基づいて content と asset の登録規則を適用する

## ステータス

決定

## 範囲

`api backend`

## コンテキスト

- [acceptance-0003] では，podcast RSS を対象として，source collector plugin の `observe` / `acquire` 契約，`content` / `asset` モデル，および実ファイル保存先の仕様を揃えることを受け入れ条件にしている
- [ADR-0016] では，source collector plugin が `content` と `asset` の同一性判定に使う fingerprint 群を返すことを定めている
- backend は，plugin から得た内容情報と保存対象情報を登録する
- plugin が返す fingerprint 群に基づいて，何を新規作成し，何を既存主体への反映として扱うかを，backend 側の登録規則として定める必要がある
- `content` / `asset` の保存規則を明示しないままでは，upsert，snapshot，version の運用を一貫して扱えない

## 決定

- api backend は，source collector plugin の観測結果を登録するときの規則を fingerprint ベースで適用する
- backend の登録規則は，[ADR-0016] で定義する fingerprint 群に基づく
  - fingerprint の prefix も含めた完全一致を，同じ集合内で照合して同一性判定に使う
  - backend は，自らが保持している fingerprint と plugin が返す fingerprint 群との一致を用いて登録規則を適用し，自前では source 種別ごとの判定を持たない
- backend が保持する最新 fingerprint は，`content` 本体と `asset` 本体に持ち，履歴は snapshot 側に保持する
- `content` の登録では，既存 `content` と content fingerprint を照合する
  - 一致する `content` がなければ，新規 `content` を作成し，最新 fingerprint を保存し，`contentSnapshot.version = 1` を作成する
  - 一致する `content` があれば，同じ `content` を再利用し，保存する fingerprint は plugin が返した最新 version のものへ更新する
  - 一致する `content` があり，snapshot 側の情報に変更がある場合にだけ，`contentSnapshot` の次 version を追加する
- `asset` の登録では，解決済み `content` 配下で observed asset fingerprint を照合する
  - 一致する `asset` がなければ，新規 `asset` を作成し，最新の observed asset fingerprint を保存する
  - 一致する `asset` があれば，同じ `asset` を再利用し，最新の observed asset fingerprint と観測時点で得られる属性を更新する
- 一致する `content` を再利用する場合でも，`asset` の解決と更新は省略しない
- backend は，観測結果の登録後に，後続で取得または再取得すべき `asset` を識別できる情報を返せるものとする
  - 取得すべき `asset` は，acquired asset fingerprint をまだ持たない `asset` とする
  - 再取得すべき `asset` は，observed asset fingerprint が変化した `asset` とする
  - 親 `content` の fingerprint が変化した場合も，その `content` に属する `asset` は再取得対象に含める
- 実ファイル取得後の更新では，新しい `asset` を作らず，解決済み `asset` に対して保存結果を更新する
  - 取得後は acquired asset fingerprint を更新する
  - observed asset fingerprint と acquired asset fingerprint の両方が一致した場合にだけ，同一であり `assetSnapshot` の追加更新は不要とみなす
- asset fingerprint は global な同一性判定には使わず，親 content 配下での同一性判定に使う
- content が異なれば，asset fingerprint が一致しても別 asset として扱う

## 影響

- `content` / `asset` / snapshot / version の保存規則を，一貫した言葉で定義しやすくなる
- source 種別ごとの plugin 実装と backend 保存処理との責務分担を明確にしやすくなる
- backend が source ごとの判定ロジックを抱え込まずに済む
- fingerprint 導出アルゴリズムの version が増えても，upsert 規則を保ったまま照合を継続しやすくなる
- 一致判定の互換性を保ちながら，保存済み fingerprint を最新 version へ順次寄せられる
- `content` では snapshot 側の情報変化があった場合にだけ履歴を追加できる
- `asset` では `assetId` ベースの acquire 更新経路を維持しつつ，変更履歴は snapshot 側で追える
- `asset` では観測情報の一致と実体情報の一致とを分けて扱える
- `content` が既存一致でも `asset` 側の変化を取りこぼしにくくなる

## 代替案

- upsert 規則を定義せず，repository ごとの実装で個別に判断する
  - 永続化層の都合で保存規則が決まり，仕様との整合を失いやすいため採らない
- すべての保存処理を単純な create/update に分解し，upsert 規則を明示しない
  - 同一性判定と version 運用を含む保存方針が見えなくなるため採らない

## 参考資料

- [ADR-0012] ADR-0012 source collector plugin の observe と acquire の責務境界
- [ADR-0014] ADR-0014 acquire を扱うために content と asset モデルを拡張する
- [ADR-0016] ADR-0016 source collector plugin は content と asset の fingerprint を返す
- [acceptance-0003] Podcast RSS Content Asset And Storage Foundation

[ADR-0012]: ./0012-podcast-rss-observe-and-acquire-boundary.md
[ADR-0014]: ./0014-content-and-asset-model-for-acquire.md
[ADR-0016]: ./0016-source-collector-content-and-asset-identity.md
[acceptance-0003]: ../acceptance/0003-podcast-rss-content-asset-and-storage-foundation.md
