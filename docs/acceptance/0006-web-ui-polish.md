# Web UI Polish

この開発項目では，日常的に触れる見た目と情報設計に整えることを受け入れ条件とする．

## 受け入れ条件

- `web ui frontend` の見た目改善に関する受け入れ条件が，この文書として先に固定されている
- 既存の source 登録，source 一覧，content 一覧の機能は維持される
- source 一覧，content 一覧，detail を一画面内で連携して browse できる
- source を選ぶと，対応する content 一覧へ自然に辿れる
- content を選ぶと，detail 表示が自然に切り替わる
- 一覧と詳細を往復するために，画面遷移を繰り返さなくてよい
- 保存済みの音声 asset に到達して再生開始できる導線がある
- 画面全体で，主要領域の情報の優先度が視覚的に分かる
  - source 登録
  - source 一覧
  - content 一覧
  - detail
- source 登録導線が，あること
- source 登録フォームは，入力欄，inspect 結果，入力エラー，送信中状態が見分けやすい
- source 一覧は，各 source の名前，種別，URL，description，操作の位置関係が整理され，視線移動が少なく読める
- content 一覧は，タイトル，公開日，source，status などの主要情報が読み取りやすい
- detail では，選択した content の主要情報と再生導線が読み取りやすい
- 音声系 content / asset では，再生可能であることと再生導線が見て分かる
- loading / empty / error の各状態が，通常表示と紛れない見た目で表示される
- 現行の E2E と関連 frontend / backend テストが通る

## 確認方法

- Web UI を開き，一画面内で source 一覧，content 一覧，detail を行き来できることを確認する
- source を選ぶと，その source に対応する content 一覧へ切り替わることを確認する
- content を選ぶと，detail 表示が切り替わることを確認する
- source 登録フォームを開き，inspect 成功時，inspect 失敗時，validation error 時，送信中の見た目が区別できることを確認する
- source 一覧で，各 source の本文情報が整理されて読めることを確認する
- content 一覧で，主要メタデータと status が読み取りやすいことを確認する
- detail で，選択 content の主要情報と再生導線が読み取りやすいことを確認する
- 保存済み音声がある場合，Web UI から再生導線を辿って再生開始できることを確認する
- `npm run test:e2e` と関連する frontend / backend テストが通ることを確認する
