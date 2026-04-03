# ADR-0042: collector plugin は観察と取得の worker 実装を提供する

## ステータス

決定

## 範囲

`backend/`

## コンテキスト

- [ADR-0031] で backend collection architecture の大枠は整理している
- [ADR-0032] で collector plugin の責務は検討している
- [ADR-0038] と [ADR-0041] により，job runtime / bridge job / functional job worker の足場はできた
- 次は，collector を plugin としてどう backend に載せるかを詰める必要がある

## 決定

- collector plugin は，collector ごとの観察 (`observe`) と取得 (`acquire`) の worker 実装を提供する
- collector plugin との I/O 契約は versioned にする
- backend の plugin 向け read-only API は，その version に対応した plugin 向け `channel` / `collector` / `entry` を返す
- plugin 側 worker の入口は model 全体ではなく識別子ベースにする
- plugin 側 worker は，自身が使う contract version を自己申告して backend の plugin 向け read-only API から必要な model を取得する
- contract version の対応可否は backend 側が個別に判断する
  - plugin が request につけた version に backend が対応可能なら，その version で応答する
  - backend が対応不可能なら，version 不一致エラーで応答する
- contract version は plugin が backend API を呼ぶ時に自己申告するものであり，DB には持たない
- collector plugin は，自身の識別情報，能力一覧，観察 worker，取得 worker を提供する
- backend は単一の contract version で動作し，plugin scan 時にはその version を使って `abilities(version)` を呼ぶ
- 当面の `AbilityName` は plugin 単位で `collector` のみとする
- backend は collector plugin の一覧を事前に把握している前提にする
- backend は plugin 実体を解決するための registry を持つ
- 外部 plugin は backend への明示的な install を必要とする
- plugin load / upsert に関する security model は必要だが，現時点では後回しにする

## 影響

- collector plugin は metadata だけでなく functional job worker 実装も持つ
- backend 側では，plugin 向け read-only API と plugin registry が必要になる
- 外部 plugin では install の運用手順が必要になる
- plugin registry の具体 schema や install 表現などは後続で詰める必要がある

## 参考資料

- [adr-0031] ADR-0031: backend collection architecture
- [adr-0032] ADR-0032: collector plugin responsibilities
- [adr-0038] ADR-0038: job bridge worker の責務を再整理する
- [adr-0041] ADR-0041: job/db 連携テスト用の functional job worker を追加する
- [design-log-0042] 0042 collector plugin worker responsibilities

[adr-0031]: ./0031-backend-collection-architecture.md
[adr-0032]: ./0032-collector-plugin-responsibilities.md
[adr-0038]: ./0038-job-bridge-worker-bootstrap.md
[adr-0041]: ./0041-functional-job-worker-bootstrap.md
[design-log-0042]: ../design-log/0042-collector-plugin-worker-responsibilities.md
