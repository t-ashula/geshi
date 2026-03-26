# ADR-0029: log を整備する

## ステータス

決定

## 範囲

`backend/`, `cli/`

## コンテキスト

- ADR-0027 により，Lint では `no-console` を含む強い rule 群を導入する方向になっている
- そのままだと backend / cli での出力手段が不足し，`console` 禁止だけが先行する
- logging を後回しにすると，出力形式や呼び出し方が実装ごとにばらけやすい

## 決定

- backend / cli の logger ライブラリとして `pino` を採用する
- Geshi 内で直接 `pino` の生 API を広く使うのではなく，薄い logger interface を 1 枚挟む
- その interface は，少なくとも次の呼び出しを持つ
  - `debug(message: string, metadata?: LogMetadata): void`
  - `info(message: string, metadata?: LogMetadata): void`
  - `warn(message: string, metadata?: LogMetadata): void`
  - `error(message: string, metadata?: LogMetadata): void`
  - `child(bindings: LogMetadata): Logger`
- `LogMetadata` は `Record<string, unknown>` を基本とする
- log message は文字列を基本とし，必要に応じて構造化 metadata を併記する
- `Error` は message に文字列化して埋め込むのではなく，metadata 側へ明示的に渡す
- backend / cli の運用上の出力は logger を経由して行い，`console` は原則使わない
- frontend の browser 側 logging はこの ADR の対象外とする
- ログのガイドラインとして `docs/logging-guidelines.md` を整備する
  - ガイドラインの更新は，技術的な修正を除いて ADR を通して行う

## 影響

- `no-console` を backend / cli に導入しやすくなる
- 出力経路と log level を揃えやすくなる
- 後続で JSON log や構造化 metadata を扱いやすくなる
- `pino` 依存を直接全コードへ広げずに済む
- log 呼び出しのシグネチャを repository 内で統一しやすくなる
- logging の文法や severity の扱いを文書で揃えやすくなる

## 代替案

- `console` を使い続ける
  - lint 方針と運用方針がずれやすい
- logger library を使わず，自前 interface だけを先に定める
  - 実際の出力形式や運用方法が曖昧なまま残りやすい
- `pino` を wrapper なしで直接使う
  - 実装全体が library 固有 API に引っ張られやすい

## 備考

- 本 ADR は logger library と Geshi 内 interface を対象とする
- 具体的な logger module の実装や初期設定は後続の実装項目で扱う
- logger 名，既定 log level，pretty print の有無，出力先の詳細は後続で決める

## 参考資料

- [adr-0027] ADR-0027 ESLint ルールの調整方針を定める
- [logging-guidelines] logging guidelines

[adr-0027]: ./0027-eslint-rule-adjustment.md
[logging-guidelines]: ../logging-guidelines.md
