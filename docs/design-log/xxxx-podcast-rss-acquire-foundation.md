# Design Log xxxx

`podcast-rss` plugin の `acquire` を最小実装するにあたっての補足メモ．

## この段階の狙い

- `acquire` の未実装状態を解消し，plugin 契約をテストで固定する
- 取得した実ファイルを `storage` へ保存する最小経路まで含めて固める
- 今ある plugin interface のままで進め，型の大きな再設計は次段へ送る

## この段階でやること

- `sourceUrl` を使って episode 実体を HTTP 取得する
- 取得したレスポンス body を一時ディレクトリへ保存する
- 一時ディレクトリへ保存した成果物を `storage` へ移送する
- 呼び出し側へ `filePath`, `fileName`, `kind`, `contentType`, `metadata` を返す
- `metadata` に少なくとも `byteSize` を含める

## この段階でやらないこと

- `asset` テーブルへの保存
- acquire job / worker の追加
- plugin interface 自体の抜本見直し

## 判断メモ

- 現行 `AcquiredAsset` 型には `byteSize` や `sourceUrl` の専用フィールドが無い
- そのため，この段階では後段で使う補助情報を `metadata` に寄せる
- plugin 自体は `storage` 実装詳細を直接知らず，呼び出し側が一時成果物を `storage` へ移送する構成を優先候補とする
- filename はまず取得元 URL の path basename を優先し，取れないときだけ content type から決まる既定名へフォールバックする
- `externalId` は今回の `podcast-rss acquire` 最小経路では必須にしない

## observe と asset 候補の整理

- podcast RSS から直接抽出できるのは，DB の `content` 完成形ではなく episode の `content` 候補と，それに付随する `asset` 候補である
- RSS item から得られる episode 本体の情報は `content` 候補として扱う
  - 例: `guid`, `publishedAt`, `title`, `summary`
- RSS item に付随する参照先や実体 URL は `asset` 候補として扱う
  - `enclosure.url` は実音声ファイルに対応する `audio` asset 候補
  - item `link` は個別 episode page に対応する `html` asset 候補
- このため，`observe` の返り値は将来的に `content` 候補だけでなく，episode にひもづく `asset` 候補群も表現できる shape へ拡張する必要がある
- `link` や `enclosure.url` を単なる `content.externalId` のフォールバック値として消費すると，asset として保存すべき情報を失う
- podcast RSS では，`content` の一意判定にはまず `guid` を優先し，`link` や `enclosure.url` は asset 側の候補として残す方向が自然である

## observe の返り値の方向性

- `observe(source)` は，単なる `content` 候補の配列では足りない
- episode ごとに:
  - `content` を作るためのデータ
  - その `content` にひもづく `asset` を作るためのデータ一覧
    をひとまとまりで返せる必要がある
- つまり返り値は概念的には「episode 単位の結果の配列」であり，各要素が「content 候補 1 件 + asset 候補の配列」を持つ形になる
- podcast RSS の場合，たとえば 1 item から少なくとも次を組み立てうる
  - `content` 候補
  - `audio` asset 候補としての `enclosure.url`
  - `html` asset 候補としての item `link`

## acquire の単位の論点

- `observe` の返り値を上の shape に寄せると，`acquire` の入力単位も再整理が必要になる
- 少なくとも次の 2 案がある

- `acquire(content)`
  - 1 episode に対応する `content` を入力に取り，その episode に属する複数 asset をまとめて取得・保存する
  - podcast episode 1 件に対して `audio`, `html` など複数 asset を一括で扱いやすい
  - 一方で，どの asset が失敗したかの粒度や再試行単位は粗くなりやすい

- `acquire(asset)`
  - 1 つの asset 候補を入力に取り，単品で取得・保存する
  - failure / retry の粒度を asset 単位まで下げやすい
  - 一方で，episode というまとまりを呼び出し側で管理する責務が増える

- この開発項目では，`observe` が返すべき構造をまず固定し，`acquire` を `content` 単位にするか `asset` 単位にするかは，job 設計と失敗時再試行方針も含めて次の判断点として残す
