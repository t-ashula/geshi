# ADR-0026: asset と asset snapshot の責務を current state と履歴に分ける

## ステータス

決定

## 範囲

`api backend`, `crawler`, `storage`

## コンテキスト

- `asset` と `asset snapshot` の両方に，同じ属性を重ねて持っている箇所がある
- 特に `sourceUrl` と `observedFingerprint` は，`asset` 本体と `asset snapshot` の両方にあり，どちらが主体でどちらが履歴なのかが曖昧になりやすい
- `asset` は `content` に紐づく保存対象の current state を表す主体として使っている
- `asset snapshot` は，その `asset` に対して取得結果や保存結果がどう変わったかを追うための履歴として使いたい
- current state と履歴の責務が曖昧なままだと，`asset` 本体の更新規則や `asset snapshot` 追加規則がぶれやすい
- 同じ問題は `content` 側の fingerprint にもある
- [ADR-0017] では，一致する `asset` があれば observed asset fingerprint を最新 version へ更新する前提になっている
- [ADR-0017] では，一致する `content` があれば content fingerprint を最新 version へ更新する前提にもなっている
- しかし `observedFingerprint` を `asset` 本体の current state として持ちつつ，`asset snapshot` には observed fingerprint を持たせない整理に寄せるなら，この更新規則は再検討が必要になる
- `content` fingerprint についても，同じく本体 fingerprint を後から最新 version へ書き換える前提は再検討が必要になる

## 決定

- `asset` は current state を表す主体とする
- `asset snapshot` は，その `asset` の取得結果と保存結果の履歴を表すものとする
- `observedFingerprint` は `asset` 本体に持つ
  - これは current state としての observed asset fingerprint であり，`asset` 解決と current state の参照に使う
  - current state の `observedFingerprint` が既知のどれとも一致しないときは，新しい `asset` を作る
  - 一度作成した `asset` の observed fingerprint は，後から最新 version へ書き換えない
- `asset snapshot` には `observedFingerprint` を持たせない
  - `asset snapshot` は取得結果と保存結果の履歴に責務を絞る
  - `observedFingerprint` が未知なら新しい `asset` を作るため，同じ `asset` の中で observed fingerprint の履歴を追う必要はない
- 一方で，`observedFingerprint` 以外の変わり得る情報は snapshot にのみ残して多重管理状態を解消する
- この ADR は，[ADR-0017] にある「一致する `asset` があれば observed asset fingerprint を最新 version へ更新する」という規定を更新対象とする
- この ADR は，[ADR-0017] にある「一致する `content` があれば content fingerprint を最新 version へ更新する」という規定も更新対象とする
- つまり，`asset` 本体の observed fingerprint を後から最新 version へ書き換える規則は維持せず，別の登録規則へ置き換える前提で扱う
- 同様に，`content` 本体の content fingerprint を後から最新 version へ書き換える規則も維持せず，別の登録規則へ置き換える前提で扱う

## 影響

- `asset` は current state の参照先として読みやすくなる
- `asset snapshot` は取得結果と保存結果の履歴へ責務を絞りやすくなる
- `content` / `asset` の fingerprint を latest version へ順次寄せる前提をやめ，本体 fingerprint を安定させる方向へ整理できる
- 既存 schema と repository 実装は，この整理に合わせて見直しが必要になる

## 代替案

- `asset` と `asset snapshot` の両方に `observedFingerprint` と `sourceUrl` を持ち続ける
  - current state と履歴の責務が曖昧なまま残るため採らない
- `asset` を最小の identity だけにし，最新状態も毎回 `asset snapshot` から引く
  - current state を読むための基点が弱くなり，現行の使い方とずれるため採らない

## 参考資料

- [ADR-0014] ADR-0014: acquire を扱うために content と asset モデルを拡張する
- [ADR-0016] ADR-0016: source collector plugin は content と asset の fingerprint を返す
- [ADR-0017] ADR-0017: api backend は fingerprint に基づいて content と asset の登録規則を適用する
- [data-model] Data Model

[ADR-0014]: ./0014-content-and-asset-model-for-acquire.md
[ADR-0016]: ./0016-source-collector-content-and-asset-identity.md
[ADR-0017]: ./0017-source-collector-upsert-based-on-identity.md
[data-model]: ../data-model.md
