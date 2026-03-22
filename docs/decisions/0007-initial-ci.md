# ADR-0007: 初期 CI と Dependabot を導入する

## ステータス

決定

## 範囲

全体

## コンテキスト

- 現時点の Geshi には，frontend / backend / cli の初期構成と最低限の開発基盤がある
- しかし，変更ごとの機械的な検証や依存更新の自動化はまだ存在しない
- 開発フローとしては PR と CI を前提にしたいが，その前提を支える最小構成が必要である
- 一方で，format や test，coverage はまだ運用が固まっていない

## 決定

- 初期 CI として GitHub Actions を導入する
- 初期 CI が実行する検証は，現時点で安定して回せるものに絞る
  - `lint`
  - `typecheck`
  - `build`
- CI は少なくとも以下で動かす
  - `pull_request`
  - `master` への `push`
- 依存更新のために Dependabot を導入する
- format / test / coverage / workflow lint の詳細は本 ADR では決めない

## 影響

- PR ごとに最低限の静的検証と build 検証が自動で走る
- 依存更新を手動監視し続ける負担を減らせる
- 今後 test や format を追加するための CI の土台になる

## 代替案

- CI を導入せず，ローカル実行だけに任せる
  - 開発フローと整合しない
- 最初から format / test / coverage / workflow lint まで全部入れる
  - まだ決まっていない運用まで固定してしまう

## 備考

- 本 ADR は初期 CI の導入範囲だけを定める
- 検証項目の拡張は，後続の開発項目として扱う

## 参考資料

- [adr-0000] ADR-0000 ADR ドキュメントフォーマットと設計ログ
- [adr-0006] ADR-0006 開発項目駆動の開発フローを採用する

[adr-0000]: ./0000-adr-format.md
[adr-0006]: ./0006-development-flow.md
