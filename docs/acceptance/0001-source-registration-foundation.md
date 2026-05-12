# Podcast RSS Source Registration

この開発項目では，source 一覧を起点に `podcast rss source` を追加登録できる機能を，Web UI，API backend，永続化を含めて利用可能な状態まで実装することを受け入れ条件とする．

## 受け入れ条件

- `podcast rss source` 登録機能に必要な前提判断が ADR として整理され，レビューを経て `決定` になっている
- `web ui frontend` の初期表示で，登録済み source 一覧を表示できる
- `web ui frontend` で，source 追加操作から podcast RSS の登録フォームを開ける
- `api backend` に，source 一覧取得 API と podcast RSS source の登録 API が実装されている
- source 登録に必要な DB schema と migration が実装されている
- 登録要求に応じて，少なくとも `source` と `sourceSnapshot` を永続化できる
- 正常系では，利用者が入力した podcast RSS を登録完了でき，その結果が source 一覧に反映される
- 異常系では，少なくとも frontend または backend による最低限の validation と，DB の一意制約に基づく重複登録チェックを利用者に分かる形で扱える
- 登録後の source が，以後の収集や管理処理へ渡せる状態で保存される
- source 登録機能の主要な正常系と異常系が自動テストで検証されている

## 確認方法

- `docs/decisions/` に，source 登録機能の前提判断を扱う ADR が揃い，対象 ADR のステータスが `決定` になっていることを確認する
- Web UI の初期表示で source 一覧が表示されることを確認する
- `+` 操作などで追加フォームを開き，podcast RSS を入力して送信し，登録完了後に source 一覧へ反映されることを確認する
- API のテストまたは動作確認で，登録要求に対して `source` と `sourceSnapshot` が保存されることを確認する
- 必須入力不足，不正な RSS URL，重複登録に対して，最低限の validation と重複チェックが動作することを確認する
- migration を適用した環境で，source 登録に必要な schema が作成されることを確認する
- 正常系と異常系を含む自動テストが通ることを確認する
