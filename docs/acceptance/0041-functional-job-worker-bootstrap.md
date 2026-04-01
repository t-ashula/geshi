# 0041 functional job worker bootstrap 受け入れ条件

- `HealthCheck` functional job worker が [health-check.ts](../../backend/src/job/workers/health-check.ts) に追加されている
- backend の `JobApi.createJob()` から `healthCheck` job を作成できる
- runtime 経由で `export job` が投入され，functional worker wrapper に到達する
- 実行中に `running` の `job event` が記録される
- 正常終了時に `import job` が実行され，終端状態の `job event` が記録される
- test 用 PostgreSQL / Redis を用いた確認手順または test が追加されている
