# ADR-0049: 録画系 test 用 source は HLS 風 fake server で再現する

## ステータス

提案

## 範囲

`test`, `frontend`, `backend`, `crawler`

## コンテキスト

- 既存の E2E 用 source server は，固定 RSS と static mp3 を返す最小構成であり，podcast observe/acquire と transcript 用には十分だった
- 録画系では，`m3u8` playlist，`ts` segment，playlist 更新停止，無限に続く擬似 live のような挙動自体を再現したい
- 公開の配信サービスに依存すると，再現性が落ち，停止条件や失敗条件の検証が不安定になる
- 一方で，media 生成そのものは既製ツールを使った方が単純な場合が多い

## 決定

- 録画系 test 用 source は，`test/server/` 配下の fake server で HTTP 経由に再現する
- fake server は少なくとも次の 2 系統を再現できるようにする
  - 有限 stream
  - 延々と続く擬似 live stream
- fake server は，少なくとも次の異常・揺らぎを制御可能にする
  - playlist 更新停止
  - 特定 segment の 404 / 500
  - segment download 途中切断
  - 予約時刻前 offline
- backend 本体へ test 専用 route を追加せず，外部 source を模した別 process として扱う方針を維持する
- fixture media の生成には既製ツールを使ってよい
- 配信挙動の制御は fake server 側で担う
- したがって，media 生成は既製ツール，配信制御は自前 server のハイブリッド方針を採る

## 影響

- `test/server/` に録画系 route や fixture 制御が追加される
- unit / integration / e2e で，同じ fake source server を共通の外部依存として使いやすくなる
- HLS 風の挙動制御を static file 配信だけに閉じず，再現性を持って扱いやすくなる
- fixture media 生成と配信挙動制御を分けることで，test 資産を保守しやすくなる
- 一方で，fixture server 自体の状態管理とテスト起動フローを整理する必要がある

## 代替案

- 公開の HLS 配信や既存 test stream をそのまま使う
  - 再現性と異常系制御が不足するため採らない
- 完全に既製の HLS server へ寄せ，自前 route は持たない
  - playlist 停止や segment 単位の失敗注入を柔軟に制御しにくいため採らない
- backend に test 専用 endpoint を追加して録画 source を注入する
  - 本番コードへ test 専用経路を持ち込むため採らない

## 参考資料

- [ADR-0020] ADR-0020: E2E 用 source はローカル HTTP server から供給する
- [ADR-0048] ADR-0048: 録画系 acquire は専用 job orchestration と複数 worker 前提で扱う
- [acceptance-0011] Recording Job Foundation

[ADR-0020]: ./0020-e2e-local-source-server.md
[ADR-0048]: ./0048-recording-job-orchestration.md
[acceptance-0011]: ../acceptance/0011-recording-job-foundation.md
