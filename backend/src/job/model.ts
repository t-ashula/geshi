const JOB_STATUSES = [
  "registered",
  "scheduled",
  "queued",
  "running",
  "cancelling",
  "succeeded",
  "failed",
  "cancelled",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export type JobTarget = {
  resourceType: string;
  resourceId: string;
};

export type Job = {
  id: string;
  kind: string;
  target: JobTarget | null;
  payload: unknown;
  createdAt: string;
  runAfter: string | null;
};

export type JobEvent = {
  jobId: string;
  runtimeJobId: string | null;
  occurredAt: string;
  status: JobStatus;
  note: string;
};

const JOB_STATUS_ORDER: Record<JobStatus, number> = {
  registered: 0,
  scheduled: 1,
  queued: 2,
  running: 3,
  cancelling: 4,
  succeeded: 5,
  failed: 5,
  cancelled: 5,
};

const ALLOWED_JOB_STATUS_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> =
  {
    registered: ["queued", "scheduled", "failed", "cancelled", "cancelling"],
    scheduled: ["queued", "failed", "cancelled", "cancelling"],
    queued: ["running", "failed", "cancelled", "cancelling"],
    running: ["succeeded", "failed", "cancelled", "cancelling"],
    cancelling: ["succeeded", "failed", "cancelled"],
    succeeded: [],
    failed: [],
    cancelled: [],
  };

export function isTerminalJobStatus(status: JobStatus): boolean {
  return (
    status === "succeeded" || status === "failed" || status === "cancelled"
  );
}

export function isJobStatus(value: string): value is JobStatus {
  return JOB_STATUSES.includes(value as JobStatus);
}

export function canTransitionJobStatus(
  from: JobStatus,
  to: JobStatus,
): boolean {
  return ALLOWED_JOB_STATUS_TRANSITIONS[from].includes(to);
}

export function compareJobStatuses(left: JobStatus, right: JobStatus): number {
  return JOB_STATUS_ORDER[left] - JOB_STATUS_ORDER[right];
}

export function compareJobEvents(left: JobEvent, right: JobEvent): number {
  const statusOrder = compareJobStatuses(left.status, right.status);

  if (statusOrder !== 0) {
    return statusOrder;
  }

  const occurredAtOrder = left.occurredAt.localeCompare(right.occurredAt);

  if (occurredAtOrder !== 0) {
    return occurredAtOrder;
  }

  return 0;
}

export function getLatestJobEvent(
  events: readonly JobEvent[],
): JobEvent | null {
  if (events.length === 0) {
    return null;
  }

  return [...events].sort(compareJobEvents).at(-1) ?? null;
}

function isSameJobEvent(left: JobEvent, right: JobEvent): boolean {
  return (
    left.jobId === right.jobId &&
    left.runtimeJobId === right.runtimeJobId &&
    left.occurredAt === right.occurredAt &&
    left.status === right.status &&
    left.note === right.note
  );
}

export function canAppendJobEvent(
  events: readonly JobEvent[],
  nextEvent: JobEvent,
): boolean {
  const latestEvent = getLatestJobEvent(
    events.filter((event) => event.jobId === nextEvent.jobId),
  );

  if (latestEvent === null) {
    return nextEvent.status === "registered";
  }

  if (isSameJobEvent(latestEvent, nextEvent)) {
    return true;
  }

  if (isTerminalJobStatus(latestEvent.status)) {
    return false;
  }

  if (compareJobStatuses(nextEvent.status, latestEvent.status) < 0) {
    return false;
  }

  if (
    nextEvent.status === latestEvent.status &&
    nextEvent.occurredAt.localeCompare(latestEvent.occurredAt) < 0
  ) {
    return false;
  }

  if (nextEvent.status !== latestEvent.status) {
    return canTransitionJobStatus(latestEvent.status, nextEvent.status);
  }

  return true;
}

export function appendJobEvent(
  events: readonly JobEvent[],
  nextEvent: JobEvent,
): readonly JobEvent[] {
  if (!canAppendJobEvent(events, nextEvent)) {
    return events;
  }

  if (events.some((event) => isSameJobEvent(event, nextEvent))) {
    return events;
  }

  return [...events, nextEvent];
}
