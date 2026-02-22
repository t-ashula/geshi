# ADR-0001: development flow

## ステータス

決定

## 範囲

全体

## コンテキスト

- 開発フローの整理が必要
  - コミットメッセージを一定程度強制したい
  - squash によってコミット履歴を失いたくない
  - 小規模開発におけるブランチ運用コストを抑えたい

## 決定

- trunk-based workflow を採用する
- `master` をデフォルトの保護ブランチとする
- 開発時は `master` から feature ブランチを作成し、PR で統合する
- `master` へのマージは履歴を残すため `--no-ff` を前提とする
- `master` マージ時にコミットメッセージのフォーマットチェックを行う

## 影響

- メンテナンス対象ブランチを `master` に集約できる
- squash merge を前提にしないため、コミット履歴を保持しやすい
- feature ブランチのライフサイクルが明確になり、削除判断が容易になる

## 参考資料

- [github-web-merge] GithubでのWeb上からのマージの仕方3種とその使いどころ
- [git-branching-strategies] What Are the Best Git Branching Strategies

[github-web-merge]: https://qiita.com/ko-he-8/items/94e872f2154829c868df
[git-branching-strategies]: https://www.abtasty.com/blog/git-branching-strategies/
