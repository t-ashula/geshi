# ADR-0039: backend の test を unit / mid / integration に分離する

## ステータス

決定

## 範囲

`backend/`

## コンテキスト

- [adr-0037], [adr-0038] により，backend では `job` / `job event` の保存実装と runtime bridge 実装が進み始めた
- その確認過程で，DB や runtime の物理実装に依存する不整合は，unit test だけでは見落としやすいことが分かった
- 一方で，毎回すべてを実ミドルウェアにつないで full stack を確認するのも重い
- したがって，backend の test を粒度で分け，軽い確認と実ミドルウェア確認と全体結合確認を分離する必要がある
- test の粒度整理としては，Google Testing Blog の test sizes の考え方を参考にする

## 決定

- backend の test は，少なくとも次の 3 段階に分離する
  - `unit test`
  - `mid test`
  - `integration test`
- `unit test` は `small` に相当するものとして扱う
  - DB や runtime などの実ミドルウェアには接続しない
  - モックやスタブを使って，ユースケースや変換処理を軽く確認する
- `mid test` は `medium` に相当するものとして扱う
  - PostgreSQL や Redis などの実ミドルウェアに接続して確認してよい
  - ただし backend 全体や full stack を通すのではなく，store 実装や runtime adapter 実装の確認に留める
  - test 用 PostgreSQL の初期化には `backend/db/schema.sql` を使ってよい
- `integration test` は `large` に相当するものとして扱う
  - backend / runtime / 実ミドルウェアを含む結合確認に使う
- 実ミドルウェア依存の実装確認は，unit test ではなく `mid test` で行う
- full stack の結合確認は `integration test` に寄せる

### npm scripts

- `test` は `test:unit` に展開する
  - `test:unit` は `test:unit:back` と `test:unit:front` に展開する
- `test:mid` は `test:mid:back` と `test:mid:front` に展開する
- script 名は `test:(unit|mid):(back|front)` の形を基本にする
- integration は front/back 両方を使う e2e として `test:integration` に寄せる

### ディレクトリ構成

- backend / frontend ともに test/unit, test/mid に分ける．
- integration は geshi 直下の `test/` におく想定で詳細や実現方法は後続できめる
- unit テストにおいては，backend / frontend どちらも，その配下のディレクトリ構成を踏襲する
  - 例: `backend/test/unit/job/` には `backend/src/job/` 配下のコードについてのテストコードを置く

## 影響

- 軽い test と実ミドルウェア確認と全体結合確認の役割が分かれる
- unit test だけでは見落とす実装依存の不整合を，継続的に検出しやすくなる
- test 用 PostgreSQL や Redis の起動方法，接続先，前処理 / 後処理を後続で決める必要がある

## 参考資料

- [adr-0036] ADR-0036 BackendStore 実装では ORM を採用せず runtime は pg, migration は dbmate を使う
- [adr-0037] ADR-0037 job と job event を PostgreSQL で実装する
- [adr-0038] ADR-0038: job bridge worker の責務を再整理する
- [google-test-sizes] Google Testing Blog: Test Sizes

[adr-0036]: ./0036-backend-store-orm-and-migration-policy.md
[adr-0037]: ./0037-job-store-bootstrap.md
[adr-0038]: ./0038-job-bridge-worker-bootstrap.md
[google-test-sizes]: https://testing.googleblog.com/2010/12/test-sizes.html
