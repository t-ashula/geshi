# ADR-0034: asset store の抽象と分離

## ステータス

提案

## 範囲

`backend/`

## コンテキスト

- `Asset` は取得済み実データを表す model として置いている
- 一方で，音声・動画・本文のような実データの保存は，収集処理の本質的な一部である
- 実データの保存先や保存方法を `Asset` model や collector workflow に直接埋め込むと，domain model と physical storage の責務が混ざりやすい
- 実ファイルをそのまま backend 中心の DB 側保存に入れるのは扱いづらいので避けたい
- 実ファイル自体を `import job` で受け渡すのは現実的ではない
- 一方で，ファイルパスのような形に寄せると，移植性と安定性に問題があり，frontend からも使いにくい

## 決定

- 実データの保存は `AssetStore` として分離する
- 従来の backend 中心の DB 側保存は，`BackendStore` として呼び分ける
- `Asset` は，主に `AssetStore` への参照と metadata を持つ model とする
- 実データそのものは `Asset` model から直接は取れず，`AssetStore` を通じて read する
- `AssetStore` は，file system や S3 のような storage の抽象とする
- metadata は `AssetStore` ではなく `Asset` model 側が持つ
- 実データ本体は `BackendStore` には保存せず，`AssetStore` に保存する
- `audio` / `video` / `text` の実データ本体は一律 `AssetStore` に入れる
- `acquireEntry` worker は `AssetStore` を read / write してよい
- backend 側には `AssetStore` の key を返して，`Asset` model に反映する
- `AssetStore` の key の第一候補は `entries/{entryId[0:2]}/{entryId[2:4]}/{entryId}/{uuidv7}.{ext}` とする
- `AssetStore` は完成済み asset の保存 abstraction とし，録画・録音中の streaming write は worker / runtime 側の責務とする
- frontend 向けの stream 配信は `AssetStore` とは別論点として扱う
- 現時点では `AssetStore` に少なくとも non-stream の read / write を持たせ，delete は扱わない

## 影響

- `Asset` model は stable な参照と metadata を持つ API / domain 表現として保ちやすくなる
- `import job` は実ファイル本体を扱わずに済み，backend API への反映に責務を絞りやすくなる
- `audio` / `video` / `text` を一律に `AssetStore` へ寄せることで，`import job` や write API の分岐を減らせる
- `BackendStore` と `AssetStore` の整合性回復や orphan の扱いは後続で整理が必要になる
- `AssetStore` の stream read や frontend 配信向け interface は後続で整理が必要になる

## 参考資料

- [adr-0031] ADR-0031 backend での情報収集とそのアーキテクチャ
- [adr-0032] ADR-0032 collector plugin の責務
- [models] データモデル
- [design-log-0034] Design log 0034 asset store abstraction

[adr-0031]: ./0031-backend-collection-architecture.md
[adr-0032]: ./0032-collector-plugin-responsibilities.md
[models]: ../models.md
[design-log-0034]: ../design-log/0034-asset-store-abstraction.md
