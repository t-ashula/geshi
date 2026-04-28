# Storage

この文書は，`geshi` における `storage` の現行仕様を記す．

## 目的

- `acquire` によって取得した実ファイルの保存先としての責務を明確にする
- `content` / `asset` の metadata と，実ファイル保存先の責務を分ける
- 保存，参照，失敗時追跡に必要な前提を揃える

## 役割

- `acquire` によって取得した実ファイルを保存する
- 保存した実ファイルを，対応する `asset` から参照できるようにする
- 実ファイル保存の成否を，後続処理が追跡できるようにする
- 当面はローカル filesystem を実装として使う
- 将来的な保存先差し替えに備えて，interface として規定する

## API

- `put`
  - 実ファイルを保存する
  - caller から保存先 key を受け取る
  - caller から保存対象の body を受け取る
  - caller から `overwrite` フラグを受け取る
  - `overwrite` によって既存 key への上書き可否を制御する
  - 保存結果として，参照に使う key を返す
- `get`
  - 保存済み実ファイルを key から参照する
- `pathJoin`
  - caller から key の各要素を受け取る
  - `storage` 実装における区切り文字で key を連結する
  - `rootDir` と連結結果をそれぞれ解決したうえで，連結結果が `rootDir` 自身またはその配下でない場合はエラーにする

## 責務境界

### storage が担うこと

- 実ファイルの保存先であること
- 保存済み実ファイルを参照するための情報を持てること
- 保存失敗時に，失敗を扱えること
- `overwrite` フラグに従って上書き可否を制御すること
- `pathJoin` によって，実装依存の区切り文字を吸収し，解決先が `rootDir` 自身またはその配下に収まることを保証することで path traversal を防ぐこと

### storage が直接は担わないこと

- `content` / `asset` metadata の正本管理
- source collector plugin の収集ロジック
- 収集対象ごとの観測ルール
- 保存先 key の意味づけ

## key の考え方

- caller が key 全体を決める
- key は，保存対象がどの `source` / `content` / 保存カテゴリに属するかを表せるものとする
- key の各要素の連結には `storage.pathJoin` を使う
- caller は，`rootDir` 外へ出ないことを前提に key 要素を組み立てる
- `storage` は，受け取った key に対して保存と参照を行う
- caller は，上書きを許可するかどうかを `overwrite` フラグで指定する

## 他コンポーネントとの関係

### crawler / plugin 呼び出し側

- 取得した実ファイルを `storage` に保存する
- 保存先 key を，必要に応じて `storage.pathJoin` を使って決めて `storage` に渡す
- 保存対象の body を `storage` に渡す
- 保存結果を metadata 側へ反映するための情報を受け取る

### api backend

- `asset` metadata を通じて保存済み実ファイルを参照可能にする
- 必要に応じて保存結果や失敗状態を利用者へ見せる
