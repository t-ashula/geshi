# ADR-0031: backend での情報収集とそのアーキテクチャ

## ステータス

決定

## 範囲

backend

## コンテキスト

- Geshi は継続的な情報収集，録画，その後続処理を行う backend を必要とする
- podcast / streaming / ordinary rss では，何を追うか，どうやって個別対象を見つけるか，どうやって利用対象データを取得するか，取得済み実データをどう扱うかが一致しない
- 取得方式の差分を backend 本体の model に直接埋め込み続けると，管理対象の概念と収集実装の概念が混ざりやすい
- [ADR-0030] では，概念，インタフェース，物理実装を分けて扱う層分離原則を導入した

## 決定

- この ADR では，backend の情報収集アーキテクチャの用語として次を導入する
  - 「観察」は，RSS・HTML・API などを継続的に見て，個別の公開物や予定を見つける処理を指す
  - 「取得」は，見つかった個別対象について，実ファイルや本文のような利用対象データをダウンロード・録画・保存する処理を指す
- backend の情報収集では，管理対象としての `Channel` と，その `Channel` をどう処理するかを表す `Collector` を分けて扱う
- `Channel` は，継続的に追う対象としての管理情報を持つ
- `Collector` は，観察の処理と，取得の処理をまとめて担う plugin と，その plugin に渡す設定を持つ
  - 一つの plugin で観察と取得の処理を扱う
  - plugin に渡す設定は backend 本体の固定フィールドへ展開せず，役割別設定を含められる柔軟な構造として保持する
- 情報収集の workflow は，既存の Geshi 側 `job` model の上の次の 3 種の job によって実現する
  - 投入ジョブ: 定期的に実行され，観察対象となる `Channel` を拾って観察ジョブを登録する
  - 観察ジョブ: `Collector` を使って個別対象を見つけ，結果を返す
  - 取得ジョブ: 見つかった個別対象について `Collector` を使って利用対象データを取得し，結果を返す
- backend の domain データ更新は，collector plugin が直接行うのではなく，backend の API を通じて反映する
- 観察ジョブと取得ジョブの実装は plugin 側で行うが，Collector のアーキテクチャと API 境界については，後続 ADR で決定する
- `Entry` は継続監視の中で見つかる個別対象，`Asset` は取得済み実データとして扱う

## 影響

- 収集方式の追加や差し替えを，backend 本体の条件分岐を増やすのではなく，`Collector` plugin の追加として進めやすくなる
- `Channel` の管理情報と収集実行設定を分けて保ちやすくなる
- 定期投入，個別対象の発見，実データ取得を別 job として整理しやすくなる
- 一方で，収集処理を 1 つの実装に閉じず，plugin 境界を維持する必要がある
- `Channel` だけを見ても実行に必要な情報が完結しなくなり，`Collector` と合わせて扱う前提が増える
- Collector plugin と runtime の境界，read-only / write API の切り分け，および `job` model との接続を後続で追加整理する必要がある

## 代替案

- 取得方式ごとに backend 本体へ専用 model を追加する
  - 媒体や方式の追加のたびに本体概念が肥大化するため採らない

## 参考資料

- [adr-0030] ADR-0030 データモデル
- [models] データモデル
- [design-log-0031] Design log 0031 backend collection architecture

[adr-0030]: ./0030-models.md
[models]: ../models.md
[design-log-0031]: ../design-log/0031-backend-collection-architecture.md
