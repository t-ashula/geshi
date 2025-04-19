# Logger

A logging module using pino.

## Installation

This package is provided as part of the geshi workspace.

## Usage

### Basic Usage

```typescript
import { logger } from 'logger';

logger.info('Information message');
logger.error('Error message');
```

### Creating Module-Specific Loggers

```typescript
import { createModuleLogger } from 'logger';

const moduleLogger = createModuleLogger('my-module');
moduleLogger.info('Module-specific log message');
```

### Creating Service-Specific Loggers

```typescript
import { createServiceLogger } from 'logger';

const serviceLogger = createServiceLogger('api-service');
serviceLogger.info('Service-specific log message');
```

### Creating Custom Loggers

```typescript
import { createLogger } from 'logger';

const customLogger = createLogger('custom-namespace', {
  // Custom options
});
customLogger.info('Custom log message');
```

### Setting Log Level

You can set the log level using the `LOG_LEVEL` environment variable, or programmatically:

```typescript
import { setLogLevel } from 'logger';

setLogLevel('debug'); // One of 'trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'
```

## Log Levels

The following log levels are supported (from lowest to highest):

- `trace`: Most detailed debug information
- `debug`: Debug information
- `info`: General information messages (default)
- `warn`: Warning messages
- `error`: Error messages
- `fatal`: Fatal error messages
- `silent`: Disables all logging
