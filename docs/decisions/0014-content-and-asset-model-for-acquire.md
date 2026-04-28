# ADR-0014: acquire を扱うために content と asset モデルを拡張する

## ステータス

決定

## 範囲

`api backend`, `storage`, `crawler`

## コンテキスト

- [ADR-0012] では，source collector plugin の `observe` が内容と保存対象を対応づけて返し，`acquire` が asset 単位で実行されることを決める
- [ADR-0013] では，podcast RSS で episode の個別ページと実音声ファイルを asset として扱うことを決める
- 既存の [data-model] では `1 content : N asset` は決まっているが，`acquire` を通じた取得と保存の流れに対して，どの情報を `content` 側で持ち，どの情報を `asset` 側で持つかはまだ十分に整理されていない
- plugin から得た情報と，`storage` に保存した結果とを `content` / `asset` モデルへどう反映するかを揃えないと，保存処理と失敗追跡の責務が曖昧になる

## 決定

- `content` は継続対象から収集された閲覧単位を表す主体として維持する
- `asset` は `content` に付随する保存対象および保存結果を表す主体として扱う
- `asset` も `content` と同様に snapshot を持つものとして扱う
- `acquire` の入力，実ファイル保存，失敗追跡に必要な情報は，`content` と `asset` の責務に分けて整理する
- `content` / `asset` モデルは，podcast RSS の episode，個別ページ，実音声ファイルを無理なく表現できるように，必要な追加または修正を行う
- `asset` には，以下の属性を持たせる
  - content に対する主たる asset を表す `primary`
  - hash algorithm を含む `checksum`
  - 最新の `observedFingerprint`
  - 最新の `acquiredFingerprint`
  - metadata 登録時点を表す `createdAt`
  - 実ファイル取得および保存完了時点を表す `acquiredAt`
- `assetSnapshot` には，`asset` の可変属性と fingerprint の各 version を保持する
- `storage` に保存した結果は，`asset` に対応づけて扱う

## 影響

- plugin から得た情報と保存後の状態を，既存の `1 content : N asset` モデルに沿って整理しやすくなる
- episode と付随 asset の保存結果を，同じ `content` 配下で追跡しやすくなる
- content に対する主たる asset を表現しやすくなる
- asset の取得前後と取得結果とを，同じ asset モデルの中で追跡しやすくなる
- asset の observed / acquired fingerprint の変化を履歴として追いやすくなる
- `content` と `asset` の責務を分けたまま，取得処理と永続化処理を接続しやすくなる
- 一方で，既存 schema，repository，service に対する追加または修正が必要になる

## 代替案

- 取得対象ごとの情報を `content` に寄せ，`asset` は最小限にとどめる
  - ページや実音声のような付随対象を `content` 側へ寄せることになり，既存の `1 content : N asset` と噛み合いにくいため採らない
- 保存後の状態を `storage` 側だけで保持し，metadata 側の `asset` には十分な情報を持たせない
  - 閲覧，失敗追跡，再取得の基点が分散するため採らない

## 参考資料

- [ADR-0012] ADR-0012 source collector plugin の observe と acquire の責務境界
- [ADR-0013] ADR-0013 podcast rss plugin で episode と付随 asset を対応づけて扱う
- [data-model] Data Model
- [acceptance-0003] Podcast RSS Content Asset And Storage Foundation

[ADR-0012]: ./0012-podcast-rss-observe-and-acquire-boundary.md
[ADR-0013]: ./0013-podcast-rss-episode-and-asset-handling.md
[data-model]: ../data-model.md
[acceptance-0003]: ../acceptance/0003-podcast-rss-content-asset-and-storage-foundation.md
