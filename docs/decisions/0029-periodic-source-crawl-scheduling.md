# ADR-0029: 定期クロール job は source 設定を走査して observe-source を投入する

## ステータス

決定

## 範囲

`crawler`, `api backend`

## コンテキスト

- [acceptance-0007] では，登録済み `source` を対象とする継続クロールが自律的に回ることを受け入れ条件にしている
- [ADR-0010] では，source クロールの実行基盤として job queue を採用したが，継続的なクロールの実現方法は後続 ADR で扱うとしている
- 継続クロールでは，`source` ごとに対応する `collector setting` が有効 / 無効と実行間隔を持てる必要がある
- 一方で，scheduler 自体にも「どの頻度で対象 `source` を走査するか」という起動時の設定が必要になる
- 定期クロールの対象は `source` であり，`asset` や個別 `content` を直接 scheduler の管理単位にはしたくない
- scheduler の実現方法としては，`source` ごとに永続的な定期 job を持つ案と，定期的に対象 `source` を走査して個別 crawl job を投入する案がある

## 決定

- 定期クロールの管理単位は `source` とする
- 定期クロールの有効 / 無効と実行間隔は，`source` に対応する `collector setting` が持つ
- scheduler 自体の走査間隔や起動方法は，個別 `source` にひもづけず，scheduler process の起動設定として持つ
- scheduler は，定期的に継続クロール対象の `source` を走査する job として実現する
- scheduler job は，走査時点でクロール対象になっている `source` ごとに `observe-source` job を投入する
- scheduler job 自体は `observe-source` を直接実行せず，個別の crawl 実行は既存の queue / worker 経路に委ねる
- 後続処理が必要かどうかの判断は `observe-source` の結果に委ね，scheduler は `source` 起点の投入に責務を限定する

## 影響

- 定期クロールの設定変更は `collector setting` に対して完結し，個別の永続 scheduler job を source ごとに作り替える必要がない
- scheduler の走査頻度を，`source` ごとのクロール間隔とは別の起動設定として扱える
- 手動起動と定期起動のどちらも `observe-source` job を入口に揃えやすくなる
- scheduler の責務を「対象 `source` の選定と job 投入」に限定できる
- 一方で，走査のたびにどの `source` を今回の対象とするかを判定する backend 側の実装が必要になる
- 同じ `source` に対する重複投入をどう避けるか，前回実行時刻や実行中状態をどう参照するかは実装時に詰める必要がある

## 代替案

- `source` ごとに永続的な定期 job を持たせる
  - source ごとの設定変更に応じた job の作成 / 更新 / 削除管理が増えるため採らない
- scheduler が `asset` や `content` を直接対象にして後続 job まで投入する
  - 継続クロールの対象が `source` であるという責務境界を崩すため採らない
- scheduler の走査頻度も `collector setting` に埋め込み，scheduler 自体の起動設定を持たない
  - source ごとのクロール方針と scheduler process の運用設定が混ざるため採らない
- scheduler を置かず，すべて外部 cron から個別 source を起動する
  - backend 内の設定と job 実行基盤を分断しやすく，運用前提が早く固定されすぎるため採らない

## 参考資料

- [ADR-0010] ADR-0010: source クロールの実行基盤として job queue を導入する
- [ADR-0011] ADR-0011: source クロールを plugin 境界で拡張可能にする
- [ADR-0025] ADR-0025: crawl job は worker 実行に必要な情報を enqueue 時点で持つ
- [acceptance-0007] Acceptance 0007 Autonomous Crawl Foundation
- [design-log-0010] Design Log 0010

[ADR-0010]: ./0010-source-crawl-job-queue.md
[ADR-0011]: ./0011-source-crawl-plugin-responsibilities.md
[ADR-0025]: ./0025-crawl-worker-input-interface.md
[acceptance-0007]: ../acceptance/0007-autonomous-crawl-foundation.md
[design-log-0010]: ../design-log/0010-source-crawl-job-queue.md
