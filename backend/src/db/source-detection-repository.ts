import type { Insertable, Kysely, Selectable } from "kysely";

import type { Result } from "../lib/result.js";
import { err, ok } from "../lib/result.js";
import type {
  JsonObject,
  SourceCollectorSourceKind,
} from "../plugins/types.js";
import type {
  DetectedSourceCandidateTable,
  GeshiDatabase,
  SourceDetectionTargetTable,
} from "./types.js";

export type SourceDetectionTarget = {
  config: JsonObject;
  enabled: boolean;
  id: string;
  intervalMinutes: number;
  lastCheckedAt: Date | null;
  pluginSlug: string;
  sourceKind: SourceCollectorSourceKind;
  state: JsonObject | undefined;
  url: string;
  userId: string;
};

export type UpdateSourceDetectionTargetInput = {
  config?: JsonObject;
  enabled?: boolean;
  id: string;
  intervalMinutes?: number;
};

export type CreateSourceDetectionTargetInput = {
  config?: JsonObject;
  enabled?: boolean;
  id: string;
  intervalMinutes?: number;
  pluginSlug: string;
  sourceKind: SourceCollectorSourceKind;
  url: string;
  userSlug: string;
};

export type SourceDetectionStateSnapshot = {
  state: JsonObject | undefined;
  updatedAt: Date | null;
};

export type DetectedSourceCandidateStatus =
  | "detected"
  | "previewed"
  | "registered"
  | "dismissed"
  | "duplicate";

export type SaveDetectedSourceCandidateInput = {
  description: string | null;
  fingerprint: string;
  normalizedUrl: string;
  pluginSlug: string;
  resolvedSourceId: string | null;
  sourceDetectionTargetId: string;
  sourceKind: SourceCollectorSourceKind;
  sourceSlug: string;
  status: DetectedSourceCandidateStatus;
  title: string | null;
  userId: string;
};

export type SavedDetectedSourceCandidate = {
  id: string;
  status: DetectedSourceCandidateStatus;
};

export type DetectedSourceCandidate = {
  description: string | null;
  firstDetectedAt: Date;
  id: string;
  lastDetectedAt: Date;
  normalizedUrl: string;
  pluginSlug: string;
  resolvedSourceId: string | null;
  sourceDetectionTargetId: string;
  sourceKind: SourceCollectorSourceKind;
  sourceSlug: string;
  status: DetectedSourceCandidateStatus;
  title: string | null;
  userId: string;
};

export type SourceDetectionRepositoryError = Error;

export class SourceDetectionRepository {
  public constructor(private readonly database: Kysely<GeshiDatabase>) {}

  public async createSourceDetectionTarget(
    input: CreateSourceDetectionTargetInput,
  ): Promise<Result<SourceDetectionTarget, SourceDetectionRepositoryError>> {
    try {
      const target = await this.database.transaction().execute(async (trx) => {
        const user = await trx
          .selectFrom("users")
          .select(["id"])
          .where("slug", "=", input.userSlug)
          .executeTakeFirst();

        if (user === undefined) {
          throw new Error(`Unknown user slug: ${input.userSlug}`);
        }

        const createdTarget = await trx
          .insertInto("source_detection_targets")
          .values({
            config: input.config ?? {},
            enabled: input.enabled ?? true,
            id: input.id,
            interval_minutes: input.intervalMinutes ?? 60,
            plugin_slug: input.pluginSlug,
            source_kind: input.sourceKind,
            url: input.url,
            user_id: user.id,
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        return toSourceDetectionTarget(createdTarget, undefined);
      });

      return ok(target);
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to create source detection target."),
      );
    }
  }

  public async listEnabledTargets(): Promise<
    Result<SourceDetectionTarget[], SourceDetectionRepositoryError>
  > {
    return this.listTargetsByEnabled(true);
  }

  public async listTargets(): Promise<
    Result<SourceDetectionTarget[], SourceDetectionRepositoryError>
  > {
    return this.listTargetsByEnabled(undefined);
  }

  public async updateSourceDetectionTarget(
    input: UpdateSourceDetectionTargetInput,
  ): Promise<
    Result<SourceDetectionTarget | null, SourceDetectionRepositoryError>
  > {
    try {
      const updatedTarget = await this.database
        .transaction()
        .execute(async (trx) => {
          const existingTarget = await trx
            .selectFrom("source_detection_targets")
            .selectAll()
            .where("id", "=", input.id)
            .executeTakeFirst();

          if (existingTarget === undefined) {
            return null;
          }

          await trx
            .updateTable("source_detection_targets")
            .set({
              config: input.config ?? existingTarget.config,
              enabled: input.enabled ?? existingTarget.enabled,
              interval_minutes:
                input.intervalMinutes ?? existingTarget.interval_minutes,
            })
            .where("id", "=", input.id)
            .executeTakeFirstOrThrow();

          const targetWithState = await trx
            .selectFrom("source_detection_targets")
            .leftJoin(
              "source_detection_states",
              "source_detection_states.source_detection_target_id",
              "source_detection_targets.id",
            )
            .selectAll("source_detection_targets")
            .select([
              "source_detection_states.state as state",
              "source_detection_states.updated_at as state_updated_at",
            ])
            .where("source_detection_targets.id", "=", input.id)
            .executeTakeFirstOrThrow();

          return toSourceDetectionTarget(targetWithState, {
            state:
              targetWithState.state === undefined
                ? undefined
                : (targetWithState.state as JsonObject),
            updated_at: targetWithState.state_updated_at,
          });
        });

      return ok(updatedTarget);
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to update source detection target."),
      );
    }
  }

  public async findDetectedSourceCandidateById(
    candidateId: string,
  ): Promise<
    Result<DetectedSourceCandidate | null, SourceDetectionRepositoryError>
  > {
    try {
      const candidate = await this.database
        .selectFrom("detected_source_candidates")
        .selectAll()
        .where("id", "=", candidateId)
        .executeTakeFirst();

      return ok(
        candidate === undefined ? null : toDetectedSourceCandidate(candidate),
      );
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to find detected source candidate."),
      );
    }
  }

  public async updateDetectedSourceCandidateStatus(
    candidateId: string,
    status: DetectedSourceCandidateStatus,
    resolvedSourceId?: string | null,
  ): Promise<
    Result<DetectedSourceCandidate | null, SourceDetectionRepositoryError>
  > {
    try {
      const updatedCandidate = await this.database
        .updateTable("detected_source_candidates")
        .set({
          last_detected_at: new Date(),
          resolved_source_id: resolvedSourceId,
          status,
        })
        .where("id", "=", candidateId)
        .returningAll()
        .executeTakeFirst();

      return ok(
        updatedCandidate === undefined
          ? null
          : toDetectedSourceCandidate(updatedCandidate),
      );
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to update detected source candidate."),
      );
    }
  }

  public async saveState(
    targetId: string,
    pluginSlug: string,
    state: JsonObject,
  ): Promise<Result<void, SourceDetectionRepositoryError>> {
    try {
      const existingState = await this.database
        .selectFrom("source_detection_states")
        .select(["id"])
        .where("source_detection_target_id", "=", targetId)
        .executeTakeFirst();

      if (existingState === undefined) {
        await this.database
          .insertInto("source_detection_states")
          .values({
            id: crypto.randomUUID(),
            plugin_slug: pluginSlug,
            source_detection_target_id: targetId,
            state,
          })
          .executeTakeFirstOrThrow();
      } else {
        await this.database
          .updateTable("source_detection_states")
          .set({
            plugin_slug: pluginSlug,
            state,
            updated_at: new Date(),
          })
          .where("id", "=", existingState.id)
          .executeTakeFirstOrThrow();
      }

      return ok(undefined);
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to save source detection state."),
      );
    }
  }

  public async markChecked(
    targetId: string,
    checkedAt: Date,
  ): Promise<Result<void, SourceDetectionRepositoryError>> {
    try {
      await this.database
        .updateTable("source_detection_targets")
        .set({
          last_checked_at: checkedAt,
        })
        .where("id", "=", targetId)
        .executeTakeFirstOrThrow();

      return ok(undefined);
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to mark source detection target checked."),
      );
    }
  }

  public async findExistingSourceIdByUrl(
    normalizedUrl: string,
  ): Promise<Result<string | null, SourceDetectionRepositoryError>> {
    try {
      const source = await this.database
        .selectFrom("sources")
        .select(["id"])
        .where("url", "=", normalizedUrl)
        .executeTakeFirst();

      return ok(source?.id ?? null);
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to resolve source by URL."),
      );
    }
  }

  public async saveDetectedSourceCandidate(
    input: SaveDetectedSourceCandidateInput,
  ): Promise<
    Result<SavedDetectedSourceCandidate, SourceDetectionRepositoryError>
  > {
    try {
      const savedCandidate = await this.database
        .transaction()
        .execute(async (trx) => {
          const existingCandidate = await trx
            .selectFrom("detected_source_candidates")
            .selectAll()
            .where("fingerprint", "=", input.fingerprint)
            .executeTakeFirst();

          if (existingCandidate === undefined) {
            const createdCandidate = await trx
              .insertInto("detected_source_candidates")
              .values(toDetectedSourceCandidateInsert(input))
              .returning(["id", "status"])
              .executeTakeFirstOrThrow();

            return {
              id: createdCandidate.id,
              status: createdCandidate.status,
            };
          }

          const nextStatus = resolveNextCandidateStatus(
            existingCandidate.status,
            input.status,
          );

          const updatedCandidate = await trx
            .updateTable("detected_source_candidates")
            .set({
              description: input.description,
              last_detected_at: new Date(),
              normalized_url: input.normalizedUrl,
              resolved_source_id: input.resolvedSourceId,
              source_slug: input.sourceSlug,
              status: nextStatus,
              title: input.title,
            })
            .where("id", "=", existingCandidate.id)
            .returning(["id", "status"])
            .executeTakeFirstOrThrow();

          return {
            id: updatedCandidate.id,
            status: updatedCandidate.status,
          };
        });

      return ok(savedCandidate);
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to save detected source candidate."),
      );
    }
  }

  public async listDetectedSourceCandidates(): Promise<
    Result<DetectedSourceCandidate[], SourceDetectionRepositoryError>
  > {
    try {
      const candidates = await this.database
        .selectFrom("detected_source_candidates")
        .selectAll()
        .orderBy("last_detected_at", "desc")
        .execute();

      return ok(candidates.map(toDetectedSourceCandidate));
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to list detected source candidates."),
      );
    }
  }

  private async listTargetsByEnabled(
    enabled: boolean | undefined,
  ): Promise<Result<SourceDetectionTarget[], SourceDetectionRepositoryError>> {
    try {
      let query = this.database
        .selectFrom("source_detection_targets")
        .leftJoin(
          "source_detection_states",
          "source_detection_states.source_detection_target_id",
          "source_detection_targets.id",
        )
        .selectAll("source_detection_targets")
        .select([
          "source_detection_states.state as state",
          "source_detection_states.updated_at as state_updated_at",
        ])
        .orderBy("source_detection_targets.created_at", "asc");

      if (enabled !== undefined) {
        query = query.where("source_detection_targets.enabled", "=", enabled);
      }

      const targets = await query.execute();

      return ok(
        targets.map((target) =>
          toSourceDetectionTarget(target, {
            state:
              target.state === undefined
                ? undefined
                : (target.state as JsonObject),
            updated_at: target.state_updated_at,
          }),
        ),
      );
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to list source detection targets."),
      );
    }
  }
}

function toSourceDetectionTarget(
  target: Selectable<SourceDetectionTargetTable>,
  state:
    | {
        state: JsonObject | undefined;
        updated_at: Date | null;
      }
    | undefined,
): SourceDetectionTarget {
  return {
    config: target.config as JsonObject,
    enabled: target.enabled,
    id: target.id,
    intervalMinutes: target.interval_minutes,
    lastCheckedAt: target.last_checked_at,
    pluginSlug: target.plugin_slug,
    sourceKind: target.source_kind,
    state: state?.state ?? undefined,
    url: target.url,
    userId: target.user_id,
  };
}

function toDetectedSourceCandidateInsert(
  input: SaveDetectedSourceCandidateInput,
): Insertable<DetectedSourceCandidateTable> {
  return {
    description: input.description,
    fingerprint: input.fingerprint,
    id: crypto.randomUUID(),
    normalized_url: input.normalizedUrl,
    plugin_slug: input.pluginSlug,
    resolved_source_id: input.resolvedSourceId,
    source_detection_target_id: input.sourceDetectionTargetId,
    source_kind: input.sourceKind,
    source_slug: input.sourceSlug,
    status: input.status,
    title: input.title,
    user_id: input.userId,
  };
}

function resolveNextCandidateStatus(
  currentStatus: DetectedSourceCandidateStatus,
  nextStatus: DetectedSourceCandidateStatus,
): DetectedSourceCandidateStatus {
  if (currentStatus === "dismissed" || currentStatus === "registered") {
    return currentStatus;
  }

  if (nextStatus === "duplicate") {
    return "duplicate";
  }

  if (currentStatus === "previewed" && nextStatus === "detected") {
    return currentStatus;
  }

  return nextStatus;
}

function toDetectedSourceCandidate(
  candidate: Selectable<DetectedSourceCandidateTable>,
): DetectedSourceCandidate {
  return {
    description: candidate.description,
    firstDetectedAt: candidate.first_detected_at,
    id: candidate.id,
    lastDetectedAt: candidate.last_detected_at,
    normalizedUrl: candidate.normalized_url,
    pluginSlug: candidate.plugin_slug,
    resolvedSourceId: candidate.resolved_source_id,
    sourceDetectionTargetId: candidate.source_detection_target_id,
    sourceKind: candidate.source_kind,
    sourceSlug: candidate.source_slug,
    status: candidate.status,
    title: candidate.title,
    userId: candidate.user_id,
  };
}
