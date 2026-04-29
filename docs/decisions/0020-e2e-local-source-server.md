# ADR-0020: E2E 用 source はローカル HTTP server から供給する

## ステータス

決定

## 範囲

`frontend`, `backend`

## コンテキスト

- [ADR-0019] では，最初の E2E を `source 登録 -> observe job 実行 -> content 一覧反映` の最小経路として，`Playwright` で検証する方針を定めている
- この E2E では `podcast rss source` の登録先 URL が必要であり，その入力 source をどう供給するかを決める必要がある
- 公開インターネット上の RSS feed に依存すると，ネットワーク不調，配信内容変更，一時停止などでテスト再現性が落ちる
- `podcast-rss` plugin は HTTP 経由で RSS を取得するため，E2E でも HTTP 経路を保ったまま再現できる方が実系に近い
- 一方で，backend に test 専用 route を足して source 内容を注入する方式は，本番コードへ test 都合の分岐を持ち込みやすい

## 決定

- E2E 用の `podcast rss source` は，ローカルで起動する HTTP server から供給する
- その server は，固定の RSS fixture を HTTP で返せる最小構成とする
- source server の実装は `test/server/` 配下に置き，backend と同じく `Hono` をベースに構成する
- E2E テストは，公開 RSS feed ではなく，このローカル source server を参照する URL を登録する
- source server は，テストプロセスから再現可能に起動・停止できるものとする
- source server が返す fixture は，最初の E2E に必要な最小内容に絞る
  - 少なくとも `podcast-rss` plugin が observe できる RSS channel / item を含む
- source fixture は，外部サービスや公開ネットワークに依存しない repo 内のテスト資産として管理する
- 実音声ファイルなどの asset fixture は，現段階では dummy ファイルを static 配置する方式で十分とする
- 最初の E2E では observe が主対象だが，後続で acquire を含める場合も，同じ source server から static asset を返せる構成を前提にしてよい
- source server の起動補助は，必要に応じて `test/scripts/` 配下の shell script から扱えるものとする

## 影響

- E2E の再現性と安定性が上がる
- `podcast-rss` plugin の HTTP fetch 経路を，実系に近い形で保ったまま検証できる
- backend や frontend に test 専用 API を足さずに済む
- fixture の追加や差し替えで，後続の E2E ケースを拡張しやすくなる
- source server の起動方法とポート管理を，E2E 実行フローの中で整理する必要がある
- backend と同系統の HTTP framework を使うため，server 側の実装規約や補助 utility を揃えやすい

## 代替案

- 公開 RSS feed をそのまま使う
  - 再現性と安定性が低く，失敗原因の切り分けが難しいため採らない
- backend に test 専用 endpoint を追加して source 内容を注入する
  - 本番コードへ test 都合の経路を増やすため採らない
- `fetch` をモックして plugin の外部取得を差し替える
  - E2E ではなく，より低い粒度の test に寄ってしまうため採らない

## 備考

- source server を別 process にするか，E2E runner から同居起動するかは実装時に決めてよい
- fixture の細かな配置先や routing は，`test/server/` 配下で再現性を保てることを優先して実装時に決める

## 参考資料

- [ADR-0011] ADR-0011 source クロールを plugin 境界で拡張可能にする
- [ADR-0019] ADR-0019 Web UI 起点の最小 E2E を Playwright で検証する
- [acceptance-0004] E2E Foundation

[ADR-0011]: ./0011-source-crawl-plugin-responsibilities.md
[ADR-0019]: ./0019-e2e-test-foundation.md
[acceptance-0004]: ../acceptance/0004-e2e-foundation.md
