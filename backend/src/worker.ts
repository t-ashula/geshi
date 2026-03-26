import { createPingWorker } from "./bullmq/index.js";
import { createLogger } from "./logger/index.js";

const worker = createPingWorker();
const logger = createLogger({ component: "bullmq-worker" });

worker.on("ready", () => {
  logger.info("bullmq worker ready.");
});
