# ADR-0030: 定期実行クローラの設定は source ごとの設定から分けて管理する

## ステータス

決定

## 範囲

全体

## コンテキスト

- 定期実行するクローラのような機能は，特定の `source` に依存する設定ではなく，`geshi` 全体に対する設定として扱いたい
- これらを同じ場所や同じ model に混ぜると，全体の実行制御と source ごとの収集条件の責務境界が曖昧になる
- 定期実行クローラの設定をどこで持つかは，まだ明示されていない

## 決定

- 定期実行クローラの設定は，個別の `source` や `collector setting` にひもづく設定から分けて管理する
- 定期実行するクローラの有効 / 無効，走査頻度，起動方法のような設定は，全体設定として扱う
- 全体設定は，「どの `source` をどう収集するか」を表す設定の置き場へ入れない
- source ごとの収集条件や plugin 固有 option は，引き続き source 側の設定で扱ってよいが，全体設定と混在させない

## 影響

- 定期実行クローラの設定を，個別 source の収集方針と切り分けて設計できる
- scheduler の責務と source ごとの収集設定の責務を混同しにくくなる
- 全体設定の主体や更新 API は別途設計する必要がある

## 代替案

- 定期実行クローラの設定も source ごとの設定に含める
  - 全体の実行制御と source ごとの収集条件が混ざるため採らない
- 全体設定と source ごとの設定の区別を設けず，機能ごとに任意の場所へ設定を増やす
  - 設定の責務境界と変更主体を追いにくくなるため採らない

## 備考

- 現在の実装では，全体設定の親主体として `app_settings` を置き，`profile_slug` を不変識別子として持つ
- `app_setting_snapshots` はその profile に対する時点ごとの全体設定値を持つ
- 全体設定の値は `app_setting_snapshots` の明示的なカラムで保持する

## 参考資料

- [ADR-0010] ADR-0010: source クロールの実行基盤として job queue を導入する
- [ADR-0029] ADR-0029: 定期クロール job は source 設定を走査して observe-source を投入する
- [system-architecture] System Architecture

[ADR-0010]: ./0010-source-crawl-job-queue.md
[ADR-0029]: ./0029-periodic-source-crawl-scheduling.md
[system-architecture]: ../system-architecture.md
