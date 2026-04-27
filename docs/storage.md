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
  - caller から保存先 namespace を受け取る
  - caller から保存対象の body または stream を受け取る
  - caller から `overwrite` フラグを受け取る
  - `storage` はその namespace 配下で衝突しない最終 key を決定する
  - `overwrite` によって既存 key への上書き可否を制御する
  - 保存結果として，参照に使う key を返す
- `get`
  - 保存済み実ファイルを key から参照する

## 責務境界

### storage が担うこと

- 実ファイルの保存先であること
- 保存済み実ファイルを参照するための情報を持てること
- 保存失敗時に，失敗を扱えること
- caller から受け取った namespace 配下で，衝突しない最終 key を決めること
- `overwrite` フラグに従って上書き可否を制御すること

### storage が直接は担わないこと

- `content` / `asset` metadata の正本管理
- source collector plugin の収集ロジック
- 収集対象ごとの観測ルール
- 保存先 namespace の意味づけ

## key の考え方

- key 全体を caller が決め切るのではなく，保存先 namespace と最終 key とで責務を分ける
- caller は，保存対象がどの `source` / `content` / 保存カテゴリに属するかを表す namespace を決める
- `storage` は，その namespace 配下で衝突しない最終 key を決める
- caller は，上書きを許可するかどうかを `overwrite` フラグで指定する
- この分担により，ローカル filesystem 上で意味のある階層を保ちつつ，衝突回避や上書き制御を `storage` 側で扱えるようにする

## 他コンポーネントとの関係

### crawler / plugin 呼び出し側

- 取得した実ファイルを `storage` に保存する
- 保存先 namespace を決めて `storage` に渡す
- 保存対象の body または stream を `storage` に渡す
- 保存結果を metadata 側へ反映するための情報を受け取る

### api backend

- `asset` metadata を通じて保存済み実ファイルを参照可能にする
- 必要に応じて保存結果や失敗状態を利用者へ見せる
