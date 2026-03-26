# 0027 eslint rule adjustment

## 位置づけ

この文書は，ADR-0027 で ESLint ルール調整方針を定めるにあたり，実際に導入対象とする rule 群とその影響を整理するための Design log である．

## 前提

- Geshi では formatter を意図的に導入しない
- そのため，format に関わる規約も ESLint 側で扱う
- frontend では Vue 固有の lint rule / 慣習を考慮する
- 一般的な TypeScript / ESLint rule と Vue の流儀が衝突する場合は，Vue 側を優先する

## 導入対象として考える rule 群

### TypeScript 基本

- `@typescript-eslint/no-unused-vars`
  - `_` 始まりの引数や変数は無視する
- `@typescript-eslint/consistent-type-imports`
- `import/consistent-type-specifier-style`

影響:

- 未使用変数の放置を防ぎやすい
- type import の書き方を揃えやすい

### import / export の並び

- `simple-import-sort/imports`
- `simple-import-sort/exports`

影響:

- import / export の並び方で毎回迷わずに済む
- 差分のノイズが減りやすい

### module 内の並び

- `perfectionist/sort-modules`

影響:

- module member の並びを一定に保ちやすい
- 反面，意味的な並びより rule が優先される場面が増える

### 基本的な安全性 / 書式

- `curly`
- `no-cond-assign`
- `no-console`

影響:

- 書き方の揺れを減らしやすい
- CLI や backend では `console` 利用に例外が必要な箇所が出る

### filename / path

- `unicorn/filename-case`
- `no-restricted-imports`

影響:

- file 名の規則を揃えやすい
- deep import を lint で防ぎやすい
- 公開境界を `index.js` 経由に揃えやすい

### Vue 固有

- `eslint-plugin-vue` の recommended 相当

影響:

- template / script setup の危険な書き方を防ぎやすい
- 一般的な TS rule や stylistic rule と衝突する箇所の調整が必要になる

## 導入時に注意する点

- sort 系 rule は自動 fix 前提でないと運用負荷が上がりやすい
- `perfectionist/sort-modules` は意味的な並びを壊すことがある
- `no-console` は frontend では比較的素直だが，backend / cli ではログ方針と合わせて調整が必要
- `no-restricted-imports` は，公開境界を `index.js` 経由にする原則に沿って設計する
- Vue 側 rule と一般 TS rule の衝突は frontend だけ別 override を持つ前提で考える

## 現時点の見立て

導入対象としては次を前提に進めるのがよい．

- `@typescript-eslint/no-unused-vars`
- `@typescript-eslint/consistent-type-imports`
- `import/consistent-type-specifier-style`
- `simple-import-sort/imports`
- `simple-import-sort/exports`
- `perfectionist/sort-modules`
- `curly`
- `no-cond-assign`
- `no-console`
- `unicorn/filename-case`
- `eslint-plugin-vue` の recommended 相当

一方で，`no-restricted-imports` は強いが，module 境界の設計とセットで入れる必要があるため，導入順には注意が要る．

## import 境界の前提

- 公開 API を持つ module / directory は，原則として `index.js` 経由で import する
- 内部実装への deep import は，原則として禁止する
- 同一 module 内の内部実装間で必要な相対 import だけを例外とする

この原則は `no-restricted-imports` で強制する前提とする．
