import { createPingWorker } from "./bullmq/index.js";

const worker = createPingWorker();

worker.on("ready", () => {
  process.stdout.write("Geshi BullMQ worker is ready\n");
});
