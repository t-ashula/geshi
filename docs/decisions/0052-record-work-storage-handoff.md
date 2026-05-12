# ADR-0052: `acquire` / `record` の artifact 受け渡しは `body` か `work storage key` の排他的 union にする

## ステータス

決定

## 範囲

`plugin`, `sdk`, `worker`, `storage`

## コンテキスト

- [ADR-0048] では，録画系を `record-content` job と `record` API 境界で扱う方針を定めている
- [ADR-0050] では，plugin と job の一般インタフェースとして `arguments` と共通 execution context を定義している
- しかし `acquire()` / `record()` の返り値として巨大な `Uint8Array` / `body` をそのまま core worker へ返すと，長時間録音や大きな download でメモリ負荷が大きい
- 一方で `ffmpeg` のような外部コマンドは，`storage` 抽象そのものではなく，実ファイルシステム上の path を前提に動くことがある
- plugin に永続 `storage` への直接書き込み責務まで持たせると，永続化方針と plugin 実装が強く結びつき，core 側の保存責務が薄れる
- そのため，「plugin が artifact を直接 `body` として返す場合」と，「plugin がいったん `work storage` に載せて key を返す場合」とを，同じ契約で表現する必要がある

## 決定

- `acquire()` と `record()` の artifact 受け渡しは，同じ返り値契約を使う
- plugin は artifact として，次のどちらか一方だけを返す
  - `body`
  - `workStorageKey`
- `body` と `workStorageKey` の両方を返してはならない
- `body` と `workStorageKey` のどちらも返さないのも不正とする
- plugin は，artifact 生成のためにローカル一時ファイルを使ってよい
- `ffmpeg` など実ファイル path が必要な plugin は，ローカル一時ファイルを作った後，必要ならその結果を `work storage` に載せて `workStorageKey` を返してよい
- core worker は返り値を次の規則で解釈する
  - `body` のみ: `storage.put(...)` で永続 `storage` に保存する
  - `workStorageKey` のみ: `work storage` から実体を取得して永続 `storage` に保存する
  - それ以外: plugin 契約違反として job を失敗させる
- asset に保存するのは `body` でも `workStorageKey` でもなく，最終的な永続 `storage key` とする
- `work storage` 上の一時ファイルは，永続 `storage` への保存成功後に削除してよい

## 影響

- SDK の `acquire` / `record` の返り値型は，`body` と `workStorageKey` の排他的 union を表現できる必要がある
- `acquire-content` worker と `record-content` worker は，共通の artifact 受け渡し規則を実装する必要がある
- plugin は，小さな artifact では `body` を返し，大きな artifact や実ファイル path 前提の処理では `workStorageKey` を返す選択ができる
- core 側は，永続保存責務を維持したまま，大きな artifact の in-memory 受け渡しを避けやすくなる
- 一方で，`work storage` の cleanup と失敗時の再実行条件を整理する必要がある

## 代替案

- 常に `body` を返し，core worker がそれをそのまま永続 `storage` へ書く
  - 大きな artifact でメモリ負荷が大きすぎるため採らない
- `record` だけ `workStorageKey` を返し，`acquire` は常に `body` を返す
  - artifact 受け渡し契約が API ごとに分かれ，worker 実装と SDK が不自然に分岐するため採らない
- plugin が永続 `storage` に直接書き込み，`storage key` をそのまま返す
  - 永続化責務が plugin 側へ漏れ，core 側の保存境界が崩れるため採らない
- plugin がローカル一時ファイル path をそのまま core worker に返す
  - ローカル path の ownership と cleanup が曖昧で，`storage` 抽象も経由しないため採らない

## 参考資料

- [ADR-0048] ADR-0048: 録画系 acquire は専用 job orchestration と複数 worker 前提で扱う
- [ADR-0050] ADR-0050: plugin と job の一般インタフェースとして next-action arguments と共通実行 context を定義する

[ADR-0048]: ./0048-recording-job-orchestration.md
[ADR-0050]: ./0050-plugin-and-job-shared-interface.md
