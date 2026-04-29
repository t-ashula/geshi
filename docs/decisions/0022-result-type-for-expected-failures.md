# ADR-0022: 期待される失敗は result 型で表現する

## ステータス

決定

## 範囲

backend / frontend

## コンテキスト

- 現在の実装では，入力検証エラー，重複登録，not found，外部取得失敗のような「起こりうる失敗」を `throw` で返す箇所と，専用戻り値型で返す箇所が混在している
- `api backend` の route handler や worker では，複数の例外型を `try-catch` で振り分けており，失敗の種類が service のシグネチャから読み取りにくい
- frontend でも API client が HTTP error を `Error` に畳み込んでおり，UI 側で失敗理由ごとの分岐がしにくい
- [ADR-0003] は，エラー時に原因と失敗箇所を追いやすい形で扱うことを求めている
- [ADR-0010] と [ADR-0018] により，job の失敗理由や運用上の追跡可能性が重要になっている
- 一方で，プログラミングミス，不変条件違反，プロセス継続不能な障害まで result 型に寄せると，異常系の責務境界が曖昧になる

## 決定

- 利用者が分岐可能な「期待される失敗」は，例外ではなく `result` 型で返す
- `result` 型は，成功値と失敗値を判別可能な discriminated union とする
  - 例: `Result<T, E> = { ok: true; value: T } | { ok: false; error: E }`
- `E` は文字列だけで済ませず，少なくとも `code` を持つ構造化された error 値にする
- 次の層では，返却値として `result` 型を採用する
  - backend の service
  - backend の plugin / storage / repository のうち，呼び出し側で分岐したい失敗を返す境界
  - frontend の API client
- route handler，worker handler，UI event handler は `result` を受けて，その層の表現へ変換する
  - route handler: HTTP status と response body
  - worker handler: job の失敗記録，可観測ログ，再試行可否
  - UI event handler: 表示メッセージ，リトライ導線，状態遷移
- `try-catch` の利用は，I/O，外部ライブラリ呼び出し，プロセス境界との接続など，例外が外から流入しうる箇所に極小化する
- 業務分岐のために広いスコープで `try-catch` を置かず，例外を `result` 型へ変換したら，それ以降は通常の条件分岐で扱う
- 例外は次の用途に限定する
  - 不変条件違反
  - プログラミングミス
  - 起動設定不備
  - その場で回復方針を持たない想定外障害
- 想定外例外は境界で捕捉し，ログ・job 状態・HTTP 500 などに変換する

### 適用基準

- 利用者入力や外部 I/O に起因し，呼び出し側が通常制御として扱う失敗は `result` 型にする
- 同じ失敗を複数境界で別々の例外型へ写像している場合は，内側から `result` 型へ寄せる
- `null` / `undefined` のみでは理由が足りない失敗は，`result` 型へ置き換える
- `findById` のように「未発見」が自然な問い合わせは `null` を許容してよいが，その後に業務上の失敗へ昇格させる箇所では `result` 型を使う
- `try-catch` を書く場合は，対象の I/O や外部呼び出しを最小スコープで囲み，変換後の通常制御を同じ `try` ブロックに混在させない

### 移行方針

- 一括置換は行わず，既存コードを触る単位で段階的に移行する
- 新規に追加する service / frontend API client は，原則として最初から `result` 型を採用する
- 既存の例外ベース API を置き換える際は，route / worker / UI の境界で変換責務が閉じるように同一変更内で整理する

## 影響

- service や API client のシグネチャから，成功時だけでなく期待される失敗も読み取れる
- route と worker の `try-catch` は，業務上の失敗分岐よりも想定外例外の隔離に集中できる
- `try-catch` の責務が I/O と外部境界に寄るため，失敗変換の位置と原因追跡が明確になる
- frontend で失敗理由ごとの表示や再試行導線を実装しやすくなる
- 失敗コード設計が増えるため，曖昧な `message` 依存を避ける運用が必要になる
- 既存の例外ベース実装と移行期間中は混在するため，境界ごとの責務を崩さないレビューが必要になる

## 代替案

- 例外ベースを維持する
  - 実装量は少ないが，期待される失敗がシグネチャに出ず，境界ごとの `catch` 分岐が増え続けるため採らない
- 失敗をすべて `null` / `undefined` や boolean で返す
  - 失敗理由，HTTP 変換，再試行可否の判断材料が不足するため採らない
- 想定外障害まで含めて全面的に result 型へ寄せる
  - 呼び出し側が回復不能な異常まで通常制御として扱うことになり，不変条件違反の発見を遅らせるため採らない

## 備考

- `result` 型の具体的な helper 関数や配置場所は，実装時に各 runtime の依存関係を見て決める
- ただし，成功 / 失敗の判別方法と error 値の構造は，この ADR の方針に従って揃える

## 参考資料

- [ADR-0003] ADR-0003: 全体アーキテクチャ
- [ADR-0010] ADR-0010: source クロールの実行基盤として job queue を導入する
- [ADR-0018] ADR-0018: backend と worker に構造化ログを導入する

[ADR-0003]: ./0003-system-architecture.md
[ADR-0010]: ./0010-source-crawl-job-queue.md
[ADR-0018]: ./0018-structured-logging.md
