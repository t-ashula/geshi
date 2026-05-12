# ADR-0025: crawl job は worker 実行に必要な情報を enqueue 時点で持つ

## ステータス

決定

## 範囲

`crawler`, `api backend`

## コンテキスト

- crawl 系 job では，worker に何を渡すかを決める必要がある
- `observe-source` と `acquire-content` は扱う対象が異なるため，同じ情報を必要としない
- 一方で，どちらの worker でも，job を作った時点で何を処理するつもりだったかが後から変わらないことは重要である
- worker に `id` だけを渡して実行時に最新状態を引き直す方式では，enqueue 後の source や設定の変更によって，job の意味が変わりうる
- 再試行時にも，最初の実行と別の情報を見始めると，失敗解析や再現がしづらくなる

## 決定

- crawl job には，worker 実行に必要な情報を enqueue 時点で持たせる
- worker には `id` だけでなく，その job が何を処理すべきかを決める情報も渡す
- すべての worker に同型のインタフェースとはしない
- worker は job 作成時点の意味を保って実行し，外部取得対象を決める情報を実行時の最新状態で置き換えない
- ただし，結果反映先の特定や状態更新のために主体の `id` を併用してよい

## 影響

- enqueue 済み job の意味が，後から source や設定を変更しても変わりにくくなる
- 再試行時も，同じ job を同じ意図で実行しやすくなる
- `observe-source` と `acquire-content` で，worker ごとに必要な情報を分けて考えやすくなる
- payload に何を含めるかという実装判断は引き続き必要だが，基準は「worker 実行に必要か」と「job 作成時点の意味を保つために必要か」になる

## 代替案

- worker には `id` だけを渡し，実行時に必要な情報をすべて最新状態から引き直す
  - enqueue 後の変更で job の意味が変わりうるため採らない
- `observe-source` と `acquire-content` に同じ情報構成を強制する
  - worker ごとの差分が見えにくくなるため採らない

## 参考資料

- [ADR-0010] ADR-0010: source クロールの実行基盤として job queue を導入する
- [ADR-0011] ADR-0011: source クロールを plugin 境界で拡張可能にする
- [ADR-0012] ADR-0012: source collector plugin の observe と acquire の責務境界
- [job-queue] Job Queue

[ADR-0010]: ./0010-source-crawl-job-queue.md
[ADR-0011]: ./0011-source-crawl-plugin-responsibilities.md
[ADR-0012]: ./0012-podcast-rss-observe-and-acquire-boundary.md
[job-queue]: ../job-queue.md
