# ADR-0028: 保存済み asset の参照と再生に backend API を追加する

## ステータス

提案

## 範囲

`api backend`, `storage`, `web ui frontend`

## コンテキスト

- `web ui frontend` で保存済み音声 asset に到達し，再生開始できるようにしたい
- 現状の `content` API だけでは，detail に必要な asset 情報や再生対象の body に辿れない
- storage の内部 key を frontend へそのまま露出すると，storage 実装の都合が API に漏れやすい
- 再生に必要な file body 自体を得る API を導入するなら，その責務を backend が持つかどうかを先に決める必要がある

## 決定

- 保存済み asset の参照と再生のために，`api backend` に asset 向け API を追加する
- `web ui frontend` は storage の内部 key を直接解釈せず，backend API 経由で asset 情報と再生対象へ到達する
- asset API は少なくとも次を扱えるようにする
  - content detail に必要な asset 情報の参照
  - 保存済み asset body の参照
- `content detail` は，再生に必要な `asset` 情報を内包して返す
- `content detail` に含める `asset` 情報には，当面の再生導線として使う `asset url` 自体を含める
- 保存済み asset body を返す責務は backend に置く
- 保存済み asset body の URL は `/media/assets/{asset-id}.{ext}` とする
- `ext` は `asset` や `asset snapshot` の保存値ではなく，`content type` から決める
- URL の `ext` が期待値と一致しない場合は 404 として扱う
- storage key や storage 実装の都合は，可能な限り backend 境界の内側へ閉じる

## 影響

- frontend は storage 実装へ直接依存せずに playback 導線を持てる
- frontend は `content detail` の `asset url` をそのまま再生導線に使える
- 将来 storage 実装や asset 配信方式が変わっても，frontend への影響を API 境界で抑えやすくなる
- asset detail と playback 導線を UI 改善の一部として実装しやすくなる

## 代替案

- frontend が storage key を直接受け取り，storage 上の path をそのまま参照する
  - storage 実装の都合が frontend に漏れ，backend 境界が弱くなるため採らない
- playback をいったん見送り，content detail だけ先に作る
  - 受け入れ要件にある「保存済み音声の再生開始」に届かないため採らない

## 参考資料

- [ADR-0015] ADR-0015: acquire した asset の保存先を filesystem storage に置く
- [ADR-0026] ADR-0026: asset と asset snapshot の責務を current state と履歴に分ける
- [acceptance-0006] Acceptance 0006 Web UI Polish

[ADR-0015]: ./0015-storage-for-acquired-assets.md
[ADR-0026]: ./0026-asset-and-asset-snapshot-boundary.md
[acceptance-0006]: ../acceptance/0006-web-ui-polish.md
