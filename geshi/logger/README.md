# Logger

pino を使用したロギングモジュール。

## インストール

このパッケージは geshi ワークスペースの一部として提供されています。

## 使用方法

### 基本的な使用方法

```typescript
import { logger } from 'logger';

logger.info('情報メッセージ');
logger.error('エラーメッセージ');
```

### モジュール固有のロガーの作成

```typescript
import { createModuleLogger } from 'logger';

const moduleLogger = createModuleLogger('my-module');
moduleLogger.info('モジュール固有のログメッセージ');
```

### サービス固有のロガーの作成

```typescript
import { createServiceLogger } from 'logger';

const serviceLogger = createServiceLogger('api-service');
serviceLogger.info('サービス固有のログメッセージ');
```

### カスタムロガーの作成

```typescript
import { createLogger } from 'logger';

const customLogger = createLogger('custom-namespace', {
  // カスタムオプション
});
customLogger.info('カスタムログメッセージ');
```

### ログレベルの設定

環境変数 `LOG_LEVEL` を使用してログレベルを設定できます。または、プログラムで設定することもできます：

```typescript
import { setLogLevel } from 'logger';

setLogLevel('debug'); // 'trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent' のいずれか
```

## ログレベル

以下のログレベルがサポートされています（低いものから高いものへ）：

- `trace`: 最も詳細なデバッグ情報
- `debug`: デバッグ情報
- `info`: 一般的な情報メッセージ（デフォルト）
- `warn`: 警告メッセージ
- `error`: エラーメッセージ
- `fatal`: 致命的なエラーメッセージ
- `silent`: すべてのログを無効化
