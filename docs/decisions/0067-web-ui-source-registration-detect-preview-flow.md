# ADR-0067: web ui frontend の source 登録フローを detect / preview / register に再構成する

## ステータス

決定

## 範囲

`frontend`, `api backend`

## コンテキスト

- 現在の web ui frontend の source 登録画面は，plugin を先に選び，URL 入力後に単一 `inspect` 補完を行う前提で構成されている
- [ADR-0024] は inspect を補助機能として扱い，失敗時も手入力で登録継続できる 1 画面 form を前提としている
- 今回は built-in `rss` / `podcast-rss` を対象に，plugin 選択先行ではなく URL 起点で候補を検知し，preview を確認したうえで登録したい
- そのためには，frontend の登録 UI を単一 form 送信から，detect / preview / register を含む状態遷移へ組み替える必要がある
- source 登録前 detect / preview の責務自体は plugin と backend に寄せるため，frontend では登録前後の状態管理と利用者向け表示責務を整理する必要がある

## 決定

- `web ui frontend` の source 登録の標準経路は，plugin 選択先行ではなく URL 起点の detect とする
- source 登録画面では，plugin 未選択でも URL だけを入力して候補検知を開始できるようにする
- frontend は detect 結果として 0 件，1 件，複数件の候補を表示できるようにする
- 各候補には，少なくとも `pluginSlug`，`sourceKind`，正規化後 URL，title，description，slug 候補，相当の識別情報を表示する
- frontend は候補ごとに preview を表示できるようにする
- preview は register と分離し，利用者が preview を見た後に登録するかどうかを選べるようにする
- 候補が 1 件だけの場合でも，利用者は補完内容を確認してから登録できるようにする
- 候補が複数件ある場合は，利用者が候補を選択できるようにする
- 複数候補の同時登録を採る場合は，利用者が複数候補を選択して 1 回で登録できるようにする
- 複数候補の同時登録を採らない場合でも，候補ごとに順に登録できるようにする
- 候補 0 件，preview 失敗，一部候補だけ preview 失敗，duplicate 登録失敗などの主要異常系で，利用者に状態が分かる表示を行い，画面全体は破綻させない
- frontend は，detect / preview / register の各失敗を分けて扱えるようにする
- plugin 一覧の手動選択 UI を残す場合でも補助機能に留め，標準経路は detect 起点とする

## 影響

- source 登録時に plugin 選択先行を避けられる
- 登録前 preview により誤登録を減らしやすくなる
- frontend は単一 form 送信から，候補検知と preview を含む状態遷移へ変わる
- backend API は frontend が detect / preview / register を分けて呼べる必要がある
- 一方で，画面状態とエラーハンドリングが従来より複雑になる

## 代替案

- 現行の plugin 選択必須 form を維持する
  - URL から登録可能性を system 側で案内できず，操作負荷も高いため採らない
- detect を行っても preview は出さない
  - 候補の妥当性を登録前に判断しづらく，誤登録の削減効果が弱いため採らない
- detect 1 件時は確認なしで即登録する
  - 利用者が補完内容や plugin 解釈を確認できず，不意の誤登録を起こしやすいため採らない

## 参考資料

- [ADR-0024] ADR-0024: web ui frontend の source 登録画面で inspect による補完を行う
- [ADR-0066] ADR-0066: source collector plugin に detect / preview 向け登録前 API を追加する
- [acceptance-0013] Source Registration Detection And Preview

[ADR-0024]: ./0024-source-registration-preview-ui-flow.md
[ADR-0066]: ./0066-source-registration-detect-and-preview-plugin-api.md
[acceptance-0013]: ../acceptance/0013-source-registration-detection-and-preview.md
