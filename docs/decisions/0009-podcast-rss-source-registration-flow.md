# ADR-0009: podcast rss source 登録フローの責務分担

## ステータス

決定

## 範囲

web ui frontend, api backend, storage

## コンテキスト

- `podcast rss source` を登録するには，source 一覧の表示，追加フォームの表示，登録要求の送信，保存後の一覧反映までの流れを定義する必要がある
- どこで validation や重複判定を行うかが曖昧なままだと，frontend と backend の責務が混ざる
- 現時点では，RSS の実在確認や crawler 起動まではスコープに入れず，最小の登録フローを成立させたい

## 決定

`podcast rss source` 登録フローでは，次の責務分担と最小スコープを採用する．

- frontend は初期表示で source 一覧を取得して表示する
- frontend は source 追加操作から登録フォームを開き，RSS URL の入力と送信結果表示を担う
- frontend は必須入力不足や明らかな URL 形式不正のような最低限の validation を行う
- backend は登録要求の最終 validation，重複判定，永続化を担う
- backend は source 一覧取得 API と source 登録 API を提供する
- storage は `source` と `sourceSnapshot` の保存を担う
- 重複登録は `sources.url_hash` の一意制約を前提に防ぐ
- RSS URL の実在確認や RSS 本体からの title / description 取得は，この段階では行わない

## 影響

- source 登録画面の入力項目と backend 契約を一続きで見直せる
- 実装前に責務の重複や漏れを洗い出しやすくなる
- RSS 実在確認や crawler 起動を後続へ分離できる

## 代替案

- まず `podcast rss` 登録だけを個別実装し，責務分担は後から整理する
  - 早く動く可能性はあるが，後続 source 追加時にやり直しが大きい

## 参考資料

- [ADR-0003] ADR-0003 全体アーキテクチャ
- [ADR-0005] ADR-0005 データモデルを主体テーブルと履歴テーブルで構成する
- [ADR-0007] ADR-0007 api backend の初期構成
- [ADR-0008] ADR-0008 source 登録に向けた永続化と migration 方針
- [system-architecture] System Architecture
- [acceptance-0001] Acceptance 0001 Podcast RSS Source Registration

[ADR-0003]: ./0003-system-architecture.md
[ADR-0005]: ./0005-data-model.md
[ADR-0007]: ./0007-api-backend-initial-architecture.md
[ADR-0008]: ./0008-source-storage-and-migration-strategy.md
[system-architecture]: ../system-architecture.md
[acceptance-0001]: ../acceptance/0001-source-registration-foundation.md
