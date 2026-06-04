# Source Collections And Browse Layouts

この開発項目では，user が source を subscription し，その subscription を整理するための上位概念として collection を導入できることを受け入れ条件とする．
利用者は subscription を collection へ出し入れでき，collection 自体の並び替えと subscription の所属変更を drag and drop で操作できる．
また source 一覧の表示は，collection を前提にした Windows Explorer 風の 1 行表示と，現状のフラットな一覧表示を切り替えて利用できることを今回の完了条件とする．
あわせて，subscription / collection / 全体設定をぶら下げる親主体として user 概念を導入し，今回追加する整理機能が user 境界に所属することも完了条件に含める．

## 受け入れ条件

- user が source を subscription できる
- source は user 固有資源ではなく，共有可能な収集対象として扱える
- source に対する user ごとの関係は subscription として表現される
- subscription，collection，全体設定の親主体として user が追加される
- subscription と collection は user に所属し，異なる user の資源と混線しない前提で扱える
- 今回の UI / 運用では単一利用者で成立してよいが，永続化構造と API は user / subscription 概念を欠落させない
- 将来 billing / plan の意味での subscription のような契約・利用条件の主体を追加しても，user / source subscription 構造と衝突しない前提で設計される
- collection は source とは独立した識別子と表示名を持ち，source 一覧や関連 API から扱える
- collection のデータ構造は，将来的な多階層化を妨げない形で定義される
- 今回の UI / 運用要件としては 1 階層で十分であり，利用者向け表示と操作は 1 階層として成立する
- collection を作成できる
- collection を名称変更できる
- collection を並び替えできる
- subscription を collection に追加できる
- subscription を collection から外せる
- subscription を collection 間で移動できる
- collection の並び替えと subscription の出し入れ，移動は drag and drop で行える
- drag and drop 操作の結果は永続化され，画面再読み込み後も維持される
- source 一覧表示に，collection を前提にした Windows Explorer 風の 1 行表示モードが追加される
- source 一覧表示に，現状のフラットな一覧表示モードが維持される
- 利用者は 2 つの表示モードを UI 上で切り替えられる
- collection に所属していない subscription も扱え，未所属 subscription が UI 上で見失われない
- collection 表示モードでは，collection とその配下 subscription の関係が明確に分かる
- フラット表示モードでは，collection 導入後も既存の source 一覧利用に近い見え方と操作性を保つ
- backend に，subscription と collection の作成，更新，並び順管理，所属更新を扱える API と永続化実装が追加される
- backend に，source / subscription / collection / 全体設定を user 境界で扱う永続化実装と API 前提が追加される
- frontend に，collection 表示，表示モード切替，drag and drop 操作，subscription 所属変更結果の反映を扱える UI 実装が追加される
- 主要な正常系と異常系について，backend / frontend / e2e のいずれか適切な粒度で自動確認が追加されている

## 確認方法

- collection を 2 件以上作成し，一覧上で表示されることを確認する
- user が source を subscription でき，同じ source を複数 user が参照できる前提でも user ごとの subscription が混線しないことを確認する
- subscription / collection / 全体設定が同一 user 配下の資源として扱われ，別 user 資源と混線しない前提で主要処理が確認できることを確認する
- collection 名を変更し，表示へ反映され，再読み込み後も維持されることを確認する
- collection の順序を drag and drop で入れ替え，表示順が更新され，再読み込み後も維持されることを確認する
- subscription を未所属状態から collection へ追加できることを確認する
- subscription をある collection から別 collection へ drag and drop で移動できることを確認する
- subscription を collection から外し，未所属として扱えることを確認する
- source 一覧表示を collection 表示モードへ切り替え，collection と subscription の関係が 1 行表示で確認できることを確認する
- source 一覧表示をフラット表示モードへ切り替え，collection 導入前に近い一覧利用ができることを確認する
- 表示モード切替後に source 選択や基本操作が破綻しないことを確認する
- collection / subscription 所属 / 表示モード切替について，主要経路が自動テストで確認されることを確認する
