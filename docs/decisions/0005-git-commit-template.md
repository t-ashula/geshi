# ADR-0005: Git コミットテンプレートの標準化

## ステータス

決定

## 範囲

全体

## コンテキスト

- リポジトリにはコミットメッセージ用テンプレート（`.commit-template.txt`）が存在する
- ただし、テンプレート利用方針が ADR として明文化されておらず、運用が個人依存になりやすい
- コミットメッセージの粒度や説明品質が揺れると、履歴の追跡とレビュー効率が低下する

## 決定

- 本リポジトリのコミットメッセージ規約として `.commit-template.txt` を標準テンプレートに採用する
- サブジェクトは `:emoji: Subject` 形式を基本とする
- 本文はテンプレート内の「The Seven Rules」に従い、`what/why` を中心に記述する
- 絵文字の語彙はテンプレート記載の一覧を基準とし、変更種別を明示するために利用する
- 各開発環境で `git config commit.template .commit-template.txt` を設定して利用する

## 影響

- コミット履歴の可読性と検索性が向上する
- レビュー時に変更意図（何を、なぜ）が追いやすくなる
- 新規参加者が同一フォーマットで履歴を残しやすくなる

## 代替案

- Conventional Commits（`feat:`, `fix:` など）を全面採用する
- テンプレートを定義せず、各自の自由記述に任せる

## 備考

- 本 ADR はコミット本文の構造を標準化するものであり、コミット粒度そのものを強制するものではない

## 参考資料

- [commit-template] Git commit template
- [beams] How to Write a Git Commit Message
- [adr-0000] ADR-0000 ADR ドキュメントフォーマットと設計ログ

[commit-template]: ../../.commit-template.txt
[beams]: http://chris.beams.io/posts/git-commit/
[adr-0000]: ./0000-adr-format.md
