# ADR-0018: backend と worker に構造化ログを導入する

## ステータス

決定

## 範囲

`backend`

## コンテキスト

- 現在の backend と worker では，運用上の出力に `console` を直接使っている箇所がある
- `observe-source` / `acquire-content` のような非同期 job では，`jobId`，`sourceId`，`pluginSlug` などの実行文脈が揃っていないと，障害追跡がしにくい
- plugin 境界ではすでに `logger` を受け取る interface があるが，backend 側の logger 実装方針はまだ固定していない
- 今後 `no-console` のような lint rule を強化する前に，backend 側の標準的な出力経路を定める必要がある
- ログの message だけに変数を埋め込む運用では，後から job 単位や source 単位で機械的に集計しにくい

## 決定

- backend と worker の運用上の出力には，構造化ログを導入する
- logger library として `pino` を採用する
- Geshi のアプリケーションコードは `pino` を直接広く参照せず，薄い logger interface を介して利用する
- その interface は，少なくとも次を持つ
  - `debug(message: string, metadata?: Record<string, unknown>): void`
  - `info(message: string, metadata?: Record<string, unknown>): void`
  - `warn(message: string, metadata?: Record<string, unknown>): void`
  - `error(message: string, metadata?: Record<string, unknown>): void`
  - `child(bindings: Record<string, unknown>): Logger`
- log message は短い文字列を基本とし，可変値や識別子は metadata へ分離して渡す
- `Error` は文字列連結で message に埋め込まず，metadata 側へ明示的に載せる
- root logger から request / worker / job / plugin 呼び出し単位の child logger を作り，共通文脈を束ねる
- 少なくとも job 実行中のログでは，`jobId`，`sourceId`，`pluginSlug`，必要に応じて `contentId` や `assetId` を metadata に含められるようにする
- frontend の browser 側 logging はこの ADR の対象外とする
- logging の文法と運用ルールは `docs/logging.md` を正本として管理する

## 影響

- backend / worker の出力形式を揃えやすくなる
- job 失敗時の原因調査で，source や plugin の文脈を追いやすくなる
- `console` 依存を減らし，後続で `no-console` を導入しやすくなる
- logger 実装の差し替えや初期設定変更を，薄い interface の内側へ閉じ込めやすくなる
- plugin interface にすでに存在する `logger` を，暫定の `console` ではなく共通実装へ寄せやすくなる

## 代替案

- `console` を使い続ける
  - 出力形式と文脈の粒度が実装ごとにばらつきやすいため採らない
- 自前 logger を 0 から実装する
  - JSON 出力，level，child logger などの基本機能を自前保守するコストが不要に増えるため採らない
- `pino` を wrapper なしで直接使う
  - アプリケーションコードが library 固有 API に強く依存しやすいため採らない

## 備考

- この ADR は logging の導入方針と interface 境界を定めるものであり，具体的な module 配置や初期設定値は実装時に決める
- log level の既定値や pretty print の有無は，ローカル開発と運用の両方を見て別途決めてよい
- `docs/logging.md` の更新は，技術的な誤記修正を除き，この ADR または後続 ADR と整合する形で行う

## 参考資料

- [ADR-0007] ADR-0007 api backend の初期構成
- [ADR-0010] ADR-0010 source クロールの実行基盤として job queue を導入する
- [ADR-0011] ADR-0011 source クロールを plugin 境界で拡張可能にする
- [plugin-doc] Plugin
- [logging-doc] Logging
- [pino] pino

[ADR-0007]: ./0007-api-backend-initial-architecture.md
[ADR-0010]: ./0010-source-crawl-job-queue.md
[ADR-0011]: ./0011-source-crawl-plugin-responsibilities.md
[plugin-doc]: ../plugin.md
[logging-doc]: ../logging.md
[pino]: https://github.com/pinojs/pino
