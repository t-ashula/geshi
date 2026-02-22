# ADR-0004: geshi (TypeScript) と scribe API (Python) の分離

## ステータス

決定

## 範囲

全体

## コンテキスト

- リポジトリ内には TypeScript 側のアプリケーション群（`geshi/`）と Python 側の API/ワーカー群（`scribe/`）が共存している
- 現状の責務分担は実装上成立しているが、アーキテクチャ境界が ADR として明文化されていない
- 境界を明文化しない場合、将来の変更で責務が混線しやすい

## 決定

- `geshi/` と `scribe/` は別コンポーネントとして分離する
- `geshi/` の責務
  - クローリング・ダウンロード・データモデル・UI を担う
  - `@geshi/scribe` クライアント経由で `scribe` API を利用する
- `scribe/` の責務
  - 文字起こしと要約の API を提供する
  - 非同期ジョブ実行（RQ/RQ Scheduler）で処理を完結させる
- コンポーネント間の主なインターフェースは HTTP API とする
  - `POST/GET /transcribe`
  - `POST/GET /summarize`
- 依存方向は `geshi -> scribe` を原則とし、`scribe` は `geshi` の内部実装へ依存しない

## 影響

- 変更時の責務境界が明確になり、レビュー観点を定義しやすい
- 言語・実行基盤が異なる部分を独立して開発・運用しやすい
- API 互換性が境界契約となるため、変更時に後方互換性の検討が必要になる

## 代替案

- TypeScript と Python を単一プロセス/単一実装へ統合する
- 文字起こし・要約処理を `geshi/` 側へ直接組み込む

## 備考

- 本 ADR は現状の構成を遡及的に記述したものであり、新規分離作業を定義するものではない

## 参考資料

- [root-readme] README
- [ts-scribe-client] geshi/scribe/src/client.ts
- [transcriber-api] scribe/docs/transcriber-api.md
- [summarizer-api] scribe/docs/summarizer-api.md
- [compose] docker-compose.yml
- [adr-0000] ADR-0000 ADR ドキュメントフォーマットと設計ログ

[root-readme]: ../../README.md
[ts-scribe-client]: ../../geshi/scribe/src/client.ts
[transcriber-api]: ../../scribe/docs/transcriber-api.md
[summarizer-api]: ../../scribe/docs/summarizer-api.md
[compose]: ../../docker-compose.yml
[adr-0000]: ./0000-adr-format.md
