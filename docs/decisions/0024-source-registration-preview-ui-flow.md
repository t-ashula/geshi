# ADR-0024: web ui frontend の source 登録画面で inspect による補完を行う

## ステータス

決定

## 範囲

web ui frontend

## コンテキスト

- 現在の source 登録フローは，frontend が URL, title, description を一度に入力させている
- 今回の段階では，URL 入力を契機に，その URL に基づく `title` / `description` を自動補完したい
- 一方で，RSS でない URL でも source として登録できること自体には意味があるため，inspect 成功を登録の前提条件にはしたくない
- そのため，inspect 失敗時も source 登録を継続できる UI にする必要がある
- inspect の取得責務自体は plugin と backend に寄せるため，frontend ではその API を起点に，登録前の状態遷移と表示責務を整理する必要がある
- [ADR-0009] の最小登録フローでは，source 追加フォームを開いてそのまま登録する前提だったが，今回はその手順を拡張する

## 決定

- `web ui frontend` は従来どおり通常の source 登録画面を表示する
- 利用者の URL 入力完了を契機に inspect API を呼び，成功した場合は `sourceSlug` / `title` / `description` の初期値として反映する
- inspect 実行中は，少なくとも inspect 対象項目の競合を避けるために必要な範囲で画面をロックできる
- inspect 失敗時も source 登録は継続可能とし，利用者は `title` / `description` を手入力して登録できる
- frontend は URL の必須や明らかな形式不正のような最低限の validation を inspect 実行前に行う
- inspect API の失敗は，登録 API の失敗と分けて表示し，補完失敗として再試行または手入力継続を選べるようにする

## 影響

- 登録画面を増やさずに，`sourceSlug` / `title` / `description` の自動補完を追加できる
- inspect 失敗時も登録自体は妨げないため，RSS ではない URL も扱える
- inspect 中の入力ロック範囲や，上書きタイミングを実装時に慎重に決める必要がある

## 代替案

- source 登録フローを 2 段階に分け，inspect 成功後に確認画面へ遷移する
  - 状態遷移は明確になるが，inspect は補助機能であり，登録前提条件ではない今回の要件にはやや強すぎるため採らない
- inspect 失敗時は登録を禁止する
  - RSS ではない URL の登録価値を失うため採らない

## 参考資料

- [ADR-0009] ADR-0009: podcast rss source 登録フローの責務分担
- [ADR-0023] ADR-0023: source collector plugin に source 登録前 inspect API を追加する
- [acceptance-0005] Acceptance 0005 Source Registration Preview

[ADR-0009]: ./0009-podcast-rss-source-registration-flow.md
[ADR-0023]: ./0023-source-registration-inspect-plugin-api.md
[acceptance-0005]: ../acceptance/0005-source-registration-preview.md
