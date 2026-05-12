# Recording Job Foundation

この開発項目では，`geshi` が `podcast` 以外，とくに録画を伴う `streaming` 系 source を扱うために，録画系 job の責務分割，plugin 契約の拡張方向，worker 配置，失敗条件，検証基盤を文書で固定したうえで，その判断に対応する最小実装が入っていることを受け入れ条件とする．

## 受け入れ条件

- この開発項目の対象が「録画系 job 設計の土台固めと，それに対応する最小実装」であることが明示されている
- `observe-source -> acquire-content` の現行接続点が `observe-source` worker に固定されていることと，それが録画系拡張の制約になっていることが文書化されている
- 録画系では，bounded download と長時間 recording を同じ `acquire-content` 契約に押し込めないことが文書化されている
- 録画系の最小 job として `record-content` を持つ方向が文書化されている
- `record-content` の責務と，plugin 側 `record` API との境界が文書化されている
- 録画系の中間生成物は，永続 `storage` ではなく作業用 `storage` を key ベースで受け渡す方針が文書化されている
- 録画系では `jobs.metadata` を provider 固有の進行情報の保持先として使う方向が文書化されている
- 録画系 queue は，既存の短時間 job とは分離し，同種 worker を複数 process 起動できる前提で設計する方針が文書化されている
- 予約時刻に複数の録画が同時開始しうるため，`record-content` queue を水平複数 worker で捌けることが要件であると文書化されている
- 録画系 plugin は `observe` の時点で asset の取得方式や録画条件を知っている前提が文書化されている
- `observe` の返り値の拡張方向として，asset 単位の next-action policy を持たせる案が文書化されている
- 上記 next-action policy に，少なくとも `download` / `record` の区別，`scheduledStartAt`，および後続 job の `jobs.metadata` に引き継ぐ plugin 固有 `arguments` が整理されている
- `observe-source` worker は，拡張後の `ObservedAsset` を見て `acquire-content` と `record-content` を分岐する方向であることが文書化されている
- next-action policy を content 単位ではなく基本的に asset 単位で持つ理由が文書化されている
- streaming source kind の追加が必要であることと，`feed | podcast` 固定の現行 SDK 制約が文書化されている
- 録画系 test には `m3u8` / `ts` を返す fake source server が必要であることが文書化されている
- 上記 fake server では，少なくとも「有限 stream」と「延々と続く擬似 live stream」の 2 系統を再現したいことが文書化されている
- playlist 更新停止，segment 404/500，途中切断，予約時刻前 offline などの揺らぎを再現したいことが文書化されている
- fixture media 生成には既製ツール，配信挙動の制御には `test/server/` の自前 fake server を使うハイブリッド方針が文書化されている
- 録画系 test 基盤でも，backend に test 専用 route を入れず，外部 source を模した別 process を使う方針が維持されている
- この開発項目で扱う範囲と，後続 ADR に分割して決める論点が切り分けられている
- `ObservedAsset` または同等の plugin SDK 契約に next-action policy を表す最小実装が追加されている
- `observe-source` worker が後続 asset 処理を一律 `acquire-content` へ固定せず，next-action policy を見て少なくとも `download` と `record` を分岐できる実装になっている
- 録画系 job として，少なくとも `record-content` の queue / payload / worker 起動入口の骨組みが追加されている
- `record-content` queue を既存 queue 群と分離して起動できることが実装で示されている
- 録画系の fake source server として，少なくとも有限 stream と擬似 live stream を返す最小 route が `test/server/` 配下に追加されている
- 上記 fake source server を使って，録画系の最小経路を確認する test が unit / integration / e2e のいずれか適切な粒度で追加されている

## 確認方法

- 録画系 job 設計の主要論点が Design log で整理されていることを確認する
- 現行 `observe-source` 実装が `acquire-content` へ直結している事実と，その拡張制約が文書に反映されていることを確認する
- 録画系の job 分割，worker 複数起動前提，停止条件，失敗条件が文書内で矛盾なく整理されていることを確認する
- `observe` の返り値 / `ObservedAsset` 拡張の方向が，録画系 job 分岐と対応づいて説明されていることを確認する
- fake source server の要件が，録画モードと異常系の検証観点に対応づいていることを確認する
- この段階で未確定の事項が，後続 ADR 論点として明示されていることを確認する
- plugin SDK，worker，job queue，test server に録画系の最小実装差分が入っていることを確認する
- `observe-source` から `download` と `record` の後続分岐がコード上で行われることを確認する
- `record-content` の worker 起動入口が追加され，独立 queue として起動できることを確認する
- fake source server と対応 test により，有限 stream と擬似 live stream の最小再現ができることを確認する
