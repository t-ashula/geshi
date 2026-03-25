import { createPingWorker } from "./bullmq/worker.js";

const worker = createPingWorker();

worker.on("ready", () => {
  console.log("Geshi BullMQ worker is ready");
});
