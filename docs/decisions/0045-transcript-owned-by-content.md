# ADR-0045: transcript は content に直接ひもづく主体として保持する

## ステータス

決定

## 範囲

`data-model`, `api backend`, `web ui frontend`

## コンテキスト

- 現行の [data-model] と [ADR-0005] では，`transcript` は `asset` に属する主体として記述されている
- 一方で，今回の `scribe` 連携では transcript を `content detail` の中で扱い，将来的にも利用者が `asset` を強く意識しない導線へ寄せたい
- transcript の検索・閲覧・要約導線は，保存ファイルそのものより `content` の文脈に近い
- ただし transcript は特定の audio file から生成されるため，どの取得結果から作られたかという由来は保持したい
- さらに，1 つの `content` に複数の audio asset や版違いの `asset snapshot` がありうるため，`content` 直下に transcript を置くだけでは，どの音源の文字起こしかが UI 上で曖昧になりうる
- `asset` に直接 transcript 本文をぶら下げると，閲覧単位としての `content` と生成元 file とが同じ責務に押し込まれやすい
- failure chunk の retry とは別に，provider version 更新など限定的な状況では，同じ音源に対して再度の文字起こしを明示的に走らせたい場合がある

## 決定

- transcript は，`asset` の派生 file としてではなく，`content` に直接ひもづく主体として保持する
- transcript は，少なくとも次の属性を持つ前提で扱う
  - `contentId`
  - `sourceAssetSnapshotId`
  - `generation`
  - `language`
  - `status`
  - `body`
  - `startedAt`
  - `finishedAt`
- `generation` は，同じ音源に対する何度目の文字起こしかを表す
  - failure chunk の retry では増やさない
  - 利用者が明示的に再文字起こししたときに増やす
- transcriptChunk を別主体として持ち，chunk 分割された部分結果はそちらへ保持する
- transcriptChunk は，少なくとも次の属性を持つ前提で扱う
  - `transcriptId`
  - `chunkIndex`
  - `status`
  - `body`
  - `sourceStartMs`
  - `sourceEndMs`
  - `failureMessage`
  - `startedAt`
  - `finishedAt`
- transcript は，生成元として audio `asset snapshot` を参照できるようにする
- transcript 本文は `content` 文脈で参照しやすいようにし，UI や検索結果はまず `content` を起点に扱う
- UI では transcript 本文だけを独立表示するのではなく，少なくとも生成元 audio を判別できる表示要素と対で扱えるようにする
- そのため，`content detail` など transcript を返す API 応答は，`assetSnapshotId` だけでなく，UI が生成元音源を識別するのに十分な snapshot 由来の音源情報を含められるようにする
- transcript は少なくとも「要求済みで実行中」と「終了済み」を区別できる状態を持つ
- 終了済みは，少なくとも成功と失敗を区別できるようにする前提で扱う
- transcript は `transcriptChunk` を `chunkIndex` 順に連結した最終本文を `body` に保持する
- transcript は，同じ audio に対する複数回の文字起こし試行を区別できるよう，何度目の文字起こしかを識別する軸を最初から持つ
- 現行の `transcript -> asset` 前提の data model / ADR 記述は，この方針に合わせて更新対象とする

## 影響

- transcript を `content detail` の中で自然に扱いやすくなる
- transcript 検索や要約導線を `content` 単位へ寄せやすくなる
- 生成元 audio file の由来は `asset snapshot` で追いつつ，表示・検索の主単位は `content` に保てる
- `scribe` の進行状態を job テーブルだけでなく transcript 主体側にも写せるため，UI が transcript 単位で実行中か終了済みかを参照しやすくなる
- 一方で，複数 audio asset がある `content` では，UI 側で生成元音源を誤認しない表示設計が追加で必要になる
- UI での誤認防止のため，API 表現にも transcript 本文だけでなく由来音源の識別情報を載せる責務が増える
- chunk 分割前提になるため，transcript の保存モデルにも部分結果と結合結果をどう分けるかの設計が必要になる
- 将来 provider version 更新などで再文字起こしを走らせるときも，既存 transcript と新しい transcript を区別して保持しやすくなる
- 一方で，既存 `data-model` と `ADR-0005` の `transcript -> asset` 記述は改訂が必要になる
- transcript の由来参照を `assetSnapshotId` のような直接参照にするか，冗長 metadata を持つかは別途詰める必要がある

## 代替案

- transcript を従来どおり `asset` 直下へ保持する
  - 生成元 file との近さはあるが，UI と検索を `content` 文脈へ寄せにくいため採らない
- transcript を `asset` の一種として派生 asset 化する
  - 派生 file の統一感はあるが，text artifact と media file の責務が混ざりやすいため採らない

## 参考資料

- [ADR-0005] ADR-0005: データモデルを主体テーブルと履歴テーブルで構成する
- [ADR-0014] ADR-0014: acquire を扱うために content と asset モデルを拡張する
- [ADR-0026] ADR-0026: asset と asset snapshot の責務を current state と履歴に分ける
- [ADR-0044] ADR-0044: scribe 連携は adapter 境界に閉じ込める
- [data-model] Data Model

[ADR-0005]: ./0005-data-model.md
[ADR-0014]: ./0014-content-and-asset-model-for-acquire.md
[ADR-0026]: ./0026-asset-and-asset-snapshot-boundary.md
[ADR-0044]: ./0044-scribe-integration-boundary.md
[data-model]: ../data-model.md
