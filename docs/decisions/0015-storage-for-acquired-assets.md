# ADR-0015: acquire した実ファイルを保存する storage の責務を定義する

## ステータス

決定

## 範囲

`storage`, `crawler`, `api backend`

## コンテキスト

- [acceptance-0003] では，取得した実ファイルが `storage` に保存されることを受け入れ条件にしている
- 既存の [system-architecture] や [data-model] では `storage` の存在と，`asset` が保存先参照を持つことは示しているが，`acquire` した実ファイルをどの責務で保存し，何を保証すべきかはまだ十分に定まっていない
- `content` / `asset` モデルと別に，実ファイル保存先としての `storage` 自体の責務と仕様を固めないと，保存成功，失敗追跡，再取得の設計が曖昧になる

## 決定

- `storage` は，`acquire` によって取得した実ファイルの保存先として扱う
- `storage` の当面の実装はローカル filesystem とする
- 将来的に `s3` などへ差し替えられるように，`storage` は interface として規定する
- `storage` は，少なくとも `asset` と対応づけられる形で，保存した実ファイルを参照できる必要がある
- `storage` の仕様は，metadata を持つ `content` / `asset` モデルとは分けて [storage-doc] に定義する
- `storage` は，少なくとも `put` と `get` を持つものとする
- caller は保存先 namespace を決めて `storage` に渡す
- caller は `put` 時に保存対象の body または stream を渡す
- caller は `put` 時に `overwrite` フラグを渡す
- `storage` は，受け取った namespace 配下で衝突しない最終 key を決める
- `storage` は，`overwrite` フラグに従って既存 key への上書き可否を制御する
- `crawler` またはその呼び出し側は，取得した実ファイルを `storage` に保存し，その結果を metadata 側へ反映できるようにする
- 保存失敗時には，失敗理由を追跡できるようにする

## 影響

- 実ファイル保存先としての `storage` の責務が，`content` / `asset` モデルとは別に明確になる
- 当面の filesystem 実装と，将来の保存先差し替え可能性とを両立しやすくなる
- caller と `storage` の間で，namespace と最終 key の責務分担を明確にできる
- 上書き可否を caller から明示的に制御できる
- `storage` 保存成功後に `asset` へ何を反映するかを，後続で整理しやすくなる
- crawler 側と metadata 側の境界を保ったまま，実ファイル保存フローを設計しやすくなる
- 一方で，namespace の具体規則，最終 key の生成規則，失敗時の後始末は追加で決める必要がある

## 代替案

- `storage` を独立した仕様として定めず，`asset` 側の説明だけで済ませる
  - metadata と実ファイル保存先の責務が混ざり，保存処理の判断点を追いづらくなるため採らない
- `storage` の責務を crawler 実装の内部都合として扱い，文書化しない
  - 実装ごとの差異が前提化され，後続の plugin や保存経路追加で整合を取りにくくなるため採らない

## 参考資料

- [ADR-0014] ADR-0014 acquire を扱うために content と asset モデルを拡張する
- [acceptance-0003] Podcast RSS Content Asset And Storage Foundation
- [system-architecture] System Architecture
- [data-model] Data Model
- [storage-doc] Storage

[ADR-0014]: ./0014-content-and-asset-model-for-acquire.md
[acceptance-0003]: ../acceptance/0003-podcast-rss-content-asset-and-storage-foundation.md
[system-architecture]: ../system-architecture.md
[data-model]: ../data-model.md
[storage-doc]: ../storage.md
