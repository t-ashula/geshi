# Source Registration Detection And Preview

この開発項目では，任意 URL を起点に登録可能な source を検出し，必要なら複数候補を提示し，preview を確認したうえで登録対象を確定できる登録体験を，backend API と frontend UI を通して実際に利用可能にすることを受け入れ条件とする．
初手の対象は built-in の `rss` / `podcast-rss` plugin とし，この 2 つで成立することをもって今回の完了条件とする．

## 受け入れ条件

- source 登録画面で，source collector plugin を先に選ばなくても URL だけを入力して source 検出を開始できる
- built-in の `rss` / `podcast-rss` plugin が，今回の detect / preview / register 経路で利用可能になっている
- source 登録画面で URL を入力すると，その URL から発見された結果として 0 件，1 件，複数件の source 候補を利用者へ提示できる
- 入力として与えた URL は，登録対象 source 自体の URL に限らず，そこから登録候補を発見できる URL を許容できる
- 検知結果の各候補には，少なくとも `pluginSlug`，`sourceKind`，正規化後 URL，title，description，slug 候補，相当の識別情報が表示され，利用者がどの候補を登録するか判断できる
- 候補ごとに preview を表示でき，利用者が「何が取れそうか」を登録前に確認できる
- preview は登録処理と分離され，preview を見た後に登録するかどうかを利用者が選べる
- 候補が 1 件だけの場合でも，利用者は自動補完された候補内容を確認してから登録できる
- 候補が複数件ある場合は，利用者が候補を選択できる
- 複数候補の一括登録を採る場合は，利用者が複数候補を同時に選択して登録できる
- 複数候補の単件登録を採る場合は，利用者が候補ごとに順に登録できる
- register 実行後，選ばれた候補に対応する source が永続化され，source 一覧から確認できる
- `rss` source を検知して登録できる
- `podcast-rss` source を検知して登録できる
- 1 つの入力 URL から複数の source 候補が返る場合は，その中から登録対象を選べる
- register 後の source には，検知時に得られた正規化後 URL，title，description，slug 候補のうち採用した値が反映される
- 候補 0 件の場合，登録処理へ進まず，利用者に候補が見つからなかったことが分かる表示になる
- preview 取得に失敗した場合，その失敗が利用者に分かる形で表示され，画面全体が破綻しない
- 一部候補だけ preview に失敗した場合でも，他の候補の確認と登録を継続できる
- duplicate source の登録を試みた場合，register 側で最終的に拒否され，利用者に重複が分かる表示になる
- detect 結果と register 実行時の状態差により登録できなくなった場合でも，利用者に失敗が分かる表示になり，不整合な中間状態を残さない
- 登録前 API は，登録確認用途として扱える範囲の実行時間と件数上限を持ち，通常利用で過大な待ちや無制限走査を起こさない
- backend に，detect / preview / register を分離して扱える API 実装が追加されている
- frontend に，URL 入力，候補検知，候補 preview，登録対象選択，登録確定の流れを扱える UI 実装が追加されている
- 上記の主要経路と主要な異常系について，unit / integration / frontend test / e2e のいずれか適切な粒度で自動確認が追加されている

## 確認方法

- source 登録 UI を開き，plugin 未選択でも URL 入力から source 検出を開始できることを確認する
- built-in `rss` source の URL を入力し，`rss` plugin による候補検知，preview，register が成立することを確認する
- built-in `podcast-rss` source の URL を入力し，`podcast-rss` plugin による候補検知，preview，register が成立することを確認する
- 検知可能な URL を入力し，その URL から発見された候補が 1 件または複数件表示され，各候補の識別情報が登録判断に足る形で見えることを確認する
- 1 つの入力 URL から複数候補を返せるケースでは，複数候補が表示され，登録対象を選べることを確認する
- preview を開き，登録前に候補内容を確認できることを確認する
- 候補を選んで register し，source 一覧に反映されることを確認する
- 候補 0 件となる URL を入力し，登録へ進まず，候補なしの表示になることを確認する
- preview 失敗を発生させ，一部または全部の候補で失敗表示が出ても，画面全体が破綻しないことを確認する
- 既存 source と重複する候補を register し，重複として拒否されることを確認する
- detect / preview / register の各 API に対する backend test，登録 UI の状態遷移に対する frontend test，または同等の e2e により主要経路が自動確認されることを確認する
