# ADR-0055: fingerprint 移行期間は legacy prefix を versioned fingerprint より古く扱う

## ステータス

決定

## 範囲

`api backend`, `plugin sdk`, `external plugin`

## コンテキスト

- [ADR-0016] では，source collector plugin が返す fingerprint に version prefix を含め，本体を固定長 hash にする方針を定めている
- しかし現実には，初期の plugin の一部が `kind:value` のような legacy 形式の fingerprint を返している
- これらを一度に versioned fingerprint へ切り替えると，既存 DB row と新しい observe / acquire / record 結果とが一致せず，同一 `content` / `asset` が二重登録されうる
- 一方で，legacy fingerprint をそのまま version として比較すると，`radiko-content` のような prefix が `2026-05-10` のような versioned prefix より後勝ちになり，current fingerprint を新形式へ寄せられない
- したがって，移行期間中は「既存 row と一致はできるが，latest 判定では新形式を必ず優先する」比較規則が必要になる

## 決定

- fingerprint の prefix が `yyyy-mm-dd` に一致するものを versioned fingerprint とみなす
- 上記に一致しない prefix を持つ fingerprint は legacy fingerprint とみなす
- backend の fingerprint 比較では，versioned fingerprint を legacy fingerprint より常に新しいものとして扱う
- versioned fingerprint 同士の比較は，従来どおり prefix の文字列比較で行う
- legacy fingerprint 同士の比較順は意味を持たせず，同順位として扱ってよい
- plugin は移行期間中，versioned fingerprint と legacy fingerprint を併記して返してよい
- backend の一致判定は，plugin が返した fingerprint 群の完全一致検索で行うため，legacy fingerprint の併記によって既存 row との照合互換を保つ
- backend の current fingerprint 更新では，latest 判定に versioned fingerprint が選ばれるため，plugin が新旧併記すれば current fingerprint を新形式へ寄せられる
- plugin SDK は，plugin test から observe / acquire / record の fingerprint 契約を検証できる helper を提供してよい
- 上記 helper は，移行期間に限って legacy fingerprint を許容する compatibility mode を持ってよい

## 影響

- legacy fingerprint しか返さない既存 plugin は，引き続き動作できる
- plugin が新旧 fingerprint を併記しても，二重登録を起こさずに current fingerprint を versioned 形式へ移行できる
- backend は fingerprint の format を一律に厳格化する前に，移行互換を保った比較規則を持てる
- plugin author は SDK helper を使って，自 plugin が strict mode なのか compatibility mode なのかを test で明示できる
- 一方で，migration 期間中は fingerprint 群に冗長な legacy 値が残るため，完全移行後に cleanup 判断が必要になる

## 代替案

- backend を変更せず，plugin を一度に versioned fingerprint へ切り替える
  - 既存 DB と一致せず二重登録を起こすため採らない
- legacy fingerprint も versioned fingerprint と同じ比較規則に載せる
  - `latest` 判定で legacy prefix が後勝ちしうるため採らない
- plugin ごとの data migration を先に行ってから fingerprint format を切り替える
  - 既存 DB から新 fingerprint を確実に再構成できるとは限らず，初期の移行戦略としては重すぎるため採らない
- legacy fingerprint を常に reject する
  - 既存 plugin と既存データを段階的に移行できないため採らない

## 参考資料

- [ADR-0016] ADR-0016: source collector plugin は content と asset の fingerprint を返す
- [ADR-0017] ADR-0017: api backend は fingerprint に基づいて content と asset の登録規則を適用する
- [ADR-0043] ADR-0043: 外部 plugin 開発のために plugin author 向け SDK 境界を分離する

[ADR-0016]: ./0016-source-collector-content-and-asset-identity.md
[ADR-0017]: ./0017-source-collector-upsert-based-on-identity.md
[ADR-0043]: ./0043-plugin-sdk-boundary-for-external-plugin-development.md
