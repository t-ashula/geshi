import { createBullmqRuntime } from "./bullmq/index.js";
import type { CreateJobRuntimeInput, JobRuntime } from "./type.js";

export function createJobRuntime(input: CreateJobRuntimeInput): JobRuntime {
  switch (input.kind) {
    case "bullmq":
      return createBullmqRuntime(input.options);
  }
}
