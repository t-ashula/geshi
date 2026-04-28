# ADR-0019: Web UI 起点の最小 E2E を Playwright で検証する

## ステータス

提案

## 範囲

`frontend`, `backend`

## コンテキスト

- [acceptance-0004] では，Web UI から `podcast rss source` を登録し，しばらく待つと `content` 一覧を確認できる最小の E2E 経路を，自動テストとして成立させることを受け入れ条件としている
- 現在の repo には frontend，api backend，worker，PostgreSQL，job queue，plugin にまたがる最小経路が存在するが，その結合をまとめて確認する自動テストはまだない
- `source` 登録から `observe` 完了までは非同期 job をまたぐため，unit test や個別の API test だけでは利用者視点の動作保証として不足する
- E2E テストでは，外部 source やテスト用 DB などの周辺実行環境も，実行方式と合わせて整理する必要がある
- 一方で，最初の E2E から acquire や asset 保存まで広げると，起動条件，失敗要因，待機時間が増え，導入コストが大きくなる

## 決定

- 最初の E2E は，Web UI を起点にした `source 登録 -> observe job 実行 -> content 一覧反映` の最小経路に絞る
- E2E のブラウザ操作には `Playwright` を採用する
- E2E テストは，frontend，api backend，worker，PostgreSQL を含む実行環境を立ち上げて検証する
- 最初の E2E では，asset の acquire 完了や実ファイル保存確認までは対象に含めない
- integration 相当の full stack 検証は，frontend / backend をまたぐ E2E として扱う
- E2E 関連の資産は，基本的に repo 直下の `test/` 配下にまとめる
  - テストケース本体は `test/cases/`
  - 起動補助やセットアップ手順は `test/scripts/`
  - そのほか必要な fixture や補助実装も `test/` 配下へ置く
- E2E の実行入口は，`Makefile` と `test/scripts/` 配下の shell script を併用して，リポジトリルートから辿れる形に揃える
- E2E 用の source 供給方法や，テスト用 DB を実運用 DB からどう分離するかは，別 ADR で定める

## 影響

- 利用者視点の最小経路を，ブラウザ操作込みで継続的に確認できる
- frontend の表示，backend API，worker 非同期処理の結合不整合を検出しやすくなる
- E2E 導入の最初の対象が observe までに限定されるため，導入コストを抑えやすくなる
- acquire や asset 保存を含むより重い検証は，後続の開発項目として分離して扱う必要がある
- source fixture や test DB の運用方針は，後続の環境 ADR に従って具体化する必要がある
- E2E 関連の script や fixture が `test/` 配下に集約され，日常コードとの境界を保ちやすくなる

## 代替案

- `Vitest Browser` などで browser 風テストに寄せる
  - UI の描画確認には使えても，worker を含む full stack の非同期経路確認としては役割が不足するため採らない
- acquire と asset 保存まで最初の E2E に含める
  - スコープが広がりすぎ，E2E 導入そのものが重くなるため採らない

## 備考

- E2E 実行時の具体的なプロセス起動方法は，この ADR に基づいて後続で決める
- テスト失敗時にどの段階で止まったかを追いやすくするため，待機条件や観測方法は実装時に明示する
- E2E テストについてのコードは test ディレクトリ配下に置く

## 参考資料

- [ADR-0006] ADR-0006 source 登録に向けた web ui frontend の初期構成
- [ADR-0007] ADR-0007 api backend の初期構成
- [ADR-0010] ADR-0010 source クロールの実行基盤として job queue を導入する
- [ADR-0011] ADR-0011 source クロールを plugin 境界で拡張可能にする
- [ADR-0020] ADR-0020 E2E 用 source はローカル HTTP server から供給する
- [ADR-0021] ADR-0021 E2E 用 DB を実運用 DB から分離する
- [acceptance-0004] E2E Foundation
- [playwright] Playwright

[ADR-0006]: ./0006-web-ui-frontend-initial-architecture.md
[ADR-0007]: ./0007-api-backend-initial-architecture.md
[ADR-0010]: ./0010-source-crawl-job-queue.md
[ADR-0011]: ./0011-source-crawl-plugin-responsibilities.md
[ADR-0020]: ./0020-e2e-local-source-server.md
[ADR-0021]: ./0021-e2e-database-isolation.md
[acceptance-0004]: ../acceptance/0004-e2e-foundation.md
[playwright]: https://playwright.dev/
