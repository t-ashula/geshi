# ADR-0018: frontend の画面モデルを定める

## ステータス

提案

## 範囲

`frontend/`

## コンテキスト

- ADR-0003 により，`frontend/` は閲覧，再生，検索，管理の UI 層として扱う
- ADR-0016 により，frontend の UI フレームワークとして Vue を採用した
- 次に `frontend/` を具体化するには，どの画面を基本単位として持つかを整理したい
- Geshi では，番組表的 UI，メーラー的 UI，管理画面，検索画面が必要になりそうである

## 決定

- `frontend/` の画面モデルを整理する
- この ADR では，画面の大分類と責務を主に扱う
- 具体的な URL 設計やコンポーネント分割は後続の開発項目で扱う

## 影響

- `frontend/` の初期実装対象が見えやすくなる
- API の読み取り単位と UI 側の要求を対応づけやすくなる
- router 導入の要否を後続で判断しやすくなる

## 代替案

- 画面モデルを決めずに実装を始める
  - 画面ごとの責務がぶれやすい
- URL 設計や router 方針まで一度に決める
  - 判断対象が広がりすぎる

## 備考

- 本 ADR は，frontend に必要な画面の種類と責務を整理するためのものである

## 参考資料

- [adr-0003] ADR-0003 frontend の初期アーキテクチャ方針
- [adr-0015] ADR-0015 backend の API 表現詳細を定める
- [adr-0016] ADR-0016 frontend の UI フレームワークを選定する

[adr-0003]: ./0003-frontend-initial-architecture.md
[adr-0015]: ./0015-backend-api-representation.md
[adr-0016]: ./0016-frontend-ui-framework-selection.md
