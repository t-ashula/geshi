# 全体アーキテクチャ

この文書は `geshi` の全体像と，当面の責務分割を記す．

`geshi` は podcast，streaming，feed を継続的に収集し，保存し，あとから再生・閲覧・検索できる個人用アーカイブである．

## 構成

### Web UI frontend

- 閲覧，検索，管理画面を提供する
- 利用者の主要な閲覧入口とする
- 単独で収集や永続化を行わず，`api backend` を利用する

### API backend

- フロントエンドや CLI からの要求を受ける
- メタデータ管理，検索，保存済みコンテンツ参照，設定操作を担当する
- 必要に応じて crawler の実行調停やジョブ受付も担う

### crawler

- podcast，streaming，feed などの外部 source から継続的に収集する
- scheduler や queue を伴うバッチ / 非同期処理の主体とする
- 収集したコンテンツと metadata を保存系へ渡す

### CLI

- 管理，保守，バッチ実行，デバッグの入口とする
- 初期セットアップや手動収集，メンテナンス操作もここに置ける

### storage

- 収集済みメディア本体を保存する
- metadata を保存する
- 検索用 index を保持する
- 必要に応じて transcript や派生データも保持する

## 通信関係

想定する主要な通信関係は以下の通り．

- `web ui frontend` -> `api backend`
- `cli` -> `api backend`
- `crawler` -> `api backend`
- `api backend` -> `storage`
- `crawler` -> `storage`

`crawler` は metadata や管理対象情報を `api backend` に渡す．
収集したファイル本体は，必要に応じて `crawler` から `storage` に直接保存してよい．

## 主な処理フロー

### 収集するとき

1. `crawler` が対象 source と実行条件を受け取る
2. `crawler` が外部 source からコンテンツと metadata を取得する
3. 必要な整形や変換を行う
4. metadata や管理対象情報を `api backend` に渡す
5. ファイル本体は必要に応じて `storage` に直接保存する
6. 保存結果を検索や閲覧に使える状態にする

### 閲覧・検索するとき

1. `web ui frontend` が利用者入力を受け取る
2. `api backend` が `storage` から metadata や検索結果を取得する
3. 必要に応じて transcript や関連情報をまとめる
4. `web ui frontend` が一覧，詳細，再生画面として表示する

### 管理・保守するとき

1. `cli` が管理コマンドを受け取る
2. `api backend` や `crawler` に必要な操作を渡す
3. 結果や状態を `cli` に返す

## 設計上の原則

### 収集系と閲覧系を分ける

- `crawler` の都合を `web ui frontend` に持ち込まない
- 閲覧 API の都合だけで収集処理を設計しない

### frontend に業務ロジックを置かない

- `web ui frontend` は表示と操作に責務を絞る
- 検索，保存，設定変更の主要ロジックは `api backend` 側に置く

### 継続収集を前提にする

- 一回限りの手動実行だけでなく，定期収集や再実行を前提にする
- source ごとの差異は主に `crawler` 側で吸収する
