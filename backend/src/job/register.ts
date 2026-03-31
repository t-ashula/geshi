import type { CreateJobRequest } from "./api.js";
import type { JobApi } from "./api.js";
import type { Job } from "./type.js";

type ExportJobQueue = {
  add(name: string, data: { jobId: string }): Promise<unknown>;
};

export async function registerJob(
  api: JobApi,
  exportQueue: ExportJobQueue,
  request: CreateJobRequest,
): Promise<Job> {
  const job = await api.createJob(request);

  await exportQueue.add("export", {
    jobId: job.id,
  });

  return job;
}
