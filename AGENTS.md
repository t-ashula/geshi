# Development guide

## Commit Gate

- コミットしてよい条件は、リポジトリルート `package.json` の次の 4 スクリプトがすべて成功すること。
  - `npm run build`
  - `npm run test`
  - `npm run lint`
  - `npm run format`
- 1 つでも失敗した場合はコミットしない。
