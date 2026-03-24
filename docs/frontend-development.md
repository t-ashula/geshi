# frontend development

## 目的

- `frontend/` の最小 Vue アプリ開発を始めるための手順をまとめる

## 前提

- Node.js 22 以上
- 依存パッケージが install 済みであること
- backend が起動していること

## 起動

- backend を起動する

```sh
npm run backend:start
```

- 別ターミナルで frontend を起動する

```sh
npm run frontend:dev
```

## 確認

- frontend を開くと，backend の `GET /health` を呼び出す
- 正常時は `backend server is healthy` と表示される
- 開発時は Vite の proxy を通して `/api/health` を backend の `/health` へ中継する

## 構成

- `frontend/src/main.ts`
  - Vue アプリの起動エントリ
- `frontend/src/App.vue`
  - 最小画面と backend 疎通確認
- `frontend/src/style.css`
  - 最小スタイル

## 備考

- Router，状態管理，UI ライブラリはまだ導入しない
- 見た目の作り込みはこの段階では対象外とする
