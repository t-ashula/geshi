import type { Kysely } from "kysely";
import { v7 as uuidv7 } from "uuid";

import type { Result } from "../lib/result.js";
import { err, ok } from "../lib/result.js";
import type { JsonObject } from "../plugins/types.js";
import type { GeshiDatabase } from "./types.js";

export type PluginGlobalRuntimeStateRecord = {
  state: JsonObject | undefined;
  version: number | null;
};

export type SavePluginGlobalRuntimeStateInput = {
  expectedVersion: number | null;
  pluginSlug: string;
  state: JsonObject;
};

export class PluginGlobalRuntimeStateVersionConflictError extends Error {
  public constructor(pluginSlug: string) {
    super(
      `Plugin global runtime state was updated concurrently: ${pluginSlug}`,
    );
    this.name = "PluginGlobalRuntimeStateVersionConflictError";
  }
}

export type PluginGlobalRuntimeStateStore = Pick<
  PluginGlobalRuntimeStateRepository,
  "findLatestByPluginSlug" | "saveState"
>;

export class PluginGlobalRuntimeStateRepository {
  public constructor(private readonly database: Kysely<GeshiDatabase>) {}

  public async findLatestByPluginSlug(
    pluginSlug: string,
  ): Promise<Result<PluginGlobalRuntimeStateRecord, Error>> {
    try {
      const runtimeState = await this.database
        .selectFrom("plugin_global_runtime_states")
        .select(["id"])
        .where("plugin_slug", "=", pluginSlug)
        .executeTakeFirst();

      if (runtimeState === undefined) {
        return ok({
          state: undefined,
          version: null,
        });
      }

      const latestSnapshot = await this.database
        .selectFrom("plugin_global_runtime_state_snapshots")
        .select(["state", "version"])
        .where("plugin_global_runtime_state_id", "=", runtimeState.id)
        .orderBy("version", "desc")
        .executeTakeFirst();

      return ok({
        state: latestSnapshot?.state as JsonObject | undefined,
        version: latestSnapshot?.version ?? null,
      });
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to read plugin global runtime state."),
      );
    }
  }

  public async saveState(
    input: SavePluginGlobalRuntimeStateInput,
  ): Promise<
    Result<number, PluginGlobalRuntimeStateVersionConflictError | Error>
  > {
    try {
      return ok(
        await this.database.transaction().execute(async (transaction) => {
          let runtimeState = await transaction
            .selectFrom("plugin_global_runtime_states")
            .select(["id"])
            .where("plugin_slug", "=", input.pluginSlug)
            .executeTakeFirst();

          if (runtimeState === undefined) {
            if (input.expectedVersion !== null) {
              throw new PluginGlobalRuntimeStateVersionConflictError(
                input.pluginSlug,
              );
            }

            const id = uuidv7();

            await transaction
              .insertInto("plugin_global_runtime_states")
              .values({
                id,
                plugin_slug: input.pluginSlug,
              })
              .executeTakeFirstOrThrow();

            runtimeState = { id };
          }

          const latestSnapshot = await transaction
            .selectFrom("plugin_global_runtime_state_snapshots")
            .select(["version"])
            .where("plugin_global_runtime_state_id", "=", runtimeState.id)
            .orderBy("version", "desc")
            .executeTakeFirst();

          const currentVersion = latestSnapshot?.version ?? null;

          if (currentVersion !== input.expectedVersion) {
            throw new PluginGlobalRuntimeStateVersionConflictError(
              input.pluginSlug,
            );
          }

          const nextVersion = (latestSnapshot?.version ?? 0) + 1;

          await transaction
            .insertInto("plugin_global_runtime_state_snapshots")
            .values({
              id: uuidv7(),
              plugin_global_runtime_state_id: runtimeState.id,
              state: input.state,
              version: nextVersion,
            })
            .executeTakeFirstOrThrow();

          return nextVersion;
        }),
      );
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to save plugin global runtime state."),
      );
    }
  }
}
