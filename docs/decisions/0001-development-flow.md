# ADR-0001: development flow

## ステータス

決定

## コンテキスト

- 開発フローの整理が必要
  - コミットメッセージを一定強制したい
  - squash することでコミットの履歴を消したくない
  - ごく小規模での開発として妥当なブランチのメンテナンス負荷

## 決定

- trunk base workflow を採用する
- git のブランチとして master をデフォルトプロテクトブランチとして用意する
- 開発ブランチとして master から feature ブランチを作り PR とする
- master へのマージはマージコミットを残す `--no-ff` とする
- master へのマージの際は，コミットメッセージのフォーマットチェックをいれる

## 影響

- メンテナンス対象が master だけですむ
- squash merge のブランチを経ないことで履歴が残る
- feature ブランチの削除がラク

## 備考

- [GithubでのWeb上からのマージの仕方3種とその使いどころ](https://qiita.com/ko-he-8/items/94e872f2154829c868df)
- [What Are the Best Git Branching Strategies](https://www.abtasty.com/blog/git-branching-strategies/)
