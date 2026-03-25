import { Queue } from "bullmq";

import { PING_QUEUE_NAME, resolveRedisConnection } from "./config.js";

export function createPingQueue(): Queue {
  return new Queue(PING_QUEUE_NAME, {
    connection: resolveRedisConnection(),
  });
}
