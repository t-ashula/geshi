# 0007 Initial CI Acceptance

## 終了条件

- GitHub Actions の workflow が追加されている
- `pull_request` と `master` への `push` で CI が動く
- CI で少なくとも以下が実行される
  - `npm run lint`
  - `npm run typecheck`
  - `npm run build`
- Dependabot の設定が追加されている
- ローカルで `npm run lint`，`npm run typecheck`，`npm run build` が通る

## 非目標

- formatter の導入
- test / coverage の導入
- workflow lint の導入
