# Podcast RSS Source Registration Preview

この開発項目では，podcast RSS source 登録画面で inspect による自動補完を行い，plugin と backend が協調して名称などを抽出し，登録用の初期データを提示できることを受け入れ条件とする．

## 受け入れ条件

- `podcast rss source` の登録前 preview に関する設計判断が frontend / backend の ADR として起票され，レビューを経て `決定` にできる状態になっている
- `web ui frontend` で，通常の source 登録画面を開ける
- `web ui frontend` で，入力した RSS URL を backend の inspect API へ送信できる
- `source collector plugin` に，RSS URL を受け取り，feed から source 登録用の初期データを返す inspect API が実装されている
- `api backend` に，plugin の inspect API を呼び出して frontend へ返す API が実装されている
- inspect API の正常系では，少なくとも正規化された URL と，`sourceSlug`，feed から取得できた `title` / `description` が返る
- `web ui frontend` で，inspect API の結果を受けて，登録画面上の `sourceSlug` / `title` / `description` を初期化できる
- inspect が失敗しても，利用者は `title` / `description` を手入力して source 登録を完了でき，登録後に source 一覧へ反映される
- inspect API の異常系では，少なくとも URL 不正，plugin 非対応，取得失敗，非 RSS または解釈不能な入力を補完失敗として利用者に分かる形で扱える
- source inspect と登録フローの主要な正常系と異常系が自動テストで検証されている

## 確認方法

- `docs/decisions/` に，source inspect の frontend / backend それぞれの責務を扱う ADR が追加され，起票時点では `提案` であることを確認する
- Web UI で source 追加操作を行い，通常の登録画面が表示されることを確認する
- 有効な RSS URL を入力して inspect を実行し，`sourceSlug` と feed 由来の `title` / `description` が同じ登録画面上へ反映されることを確認する
- inspect が失敗しても `title` / `description` を手入力して登録を完了し，source 一覧へ反映されることを確認する
- API のテストまたは動作確認で，plugin の inspect API と backend の API が正規化された URL と抽出済み初期データを返すことを確認する
- URL 不正，plugin 非対応，取得失敗，非 RSS または解釈不能な入力に対して，inspect API と Web UI が補完失敗を利用者向けに表示し，登録自体は継続できることを確認する
- 正常系と異常系を含む自動テストが通ることを確認する
