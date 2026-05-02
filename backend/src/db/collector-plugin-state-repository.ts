import type { Kysely } from "kysely";
import { v7 as uuidv7 } from "uuid";

import type { Result } from "../lib/result.js";
import { err, ok } from "../lib/result.js";
import type { JsonObject } from "../plugins/types.js";
import type { GeshiDatabase } from "./types.js";

export type SaveCollectorPluginStateInput = {
  collectorSettingId: string;
  pluginSlug: string;
  state: JsonObject;
};

export class CollectorPluginStateRepository {
  public constructor(private readonly database: Kysely<GeshiDatabase>) {}

  public async findLatestStateByCollectorSettingId(
    collectorSettingId: string,
  ): Promise<Result<JsonObject | undefined, Error>> {
    try {
      const collectorPluginState = await this.database
        .selectFrom("collector_plugin_states")
        .select(["id"])
        .where("collector_setting_id", "=", collectorSettingId)
        .executeTakeFirst();

      if (collectorPluginState === undefined) {
        return ok(undefined);
      }

      const latestSnapshot = await this.database
        .selectFrom("collector_plugin_state_snapshots")
        .select(["state"])
        .where("collector_plugin_state_id", "=", collectorPluginState.id)
        .orderBy("version", "desc")
        .executeTakeFirst();

      return ok(latestSnapshot?.state as JsonObject | undefined);
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to read collector plugin state."),
      );
    }
  }

  public async saveState(
    input: SaveCollectorPluginStateInput,
  ): Promise<Result<void, Error>> {
    try {
      await this.database.transaction().execute(async (transaction) => {
        let collectorPluginState = await transaction
          .selectFrom("collector_plugin_states")
          .select(["id", "plugin_slug"])
          .where("collector_setting_id", "=", input.collectorSettingId)
          .executeTakeFirst();

        if (collectorPluginState === undefined) {
          const id = uuidv7();

          await transaction
            .insertInto("collector_plugin_states")
            .values({
              collector_setting_id: input.collectorSettingId,
              id,
              plugin_slug: input.pluginSlug,
            })
            .executeTakeFirstOrThrow();

          collectorPluginState = {
            id,
            plugin_slug: input.pluginSlug,
          };
        }

        if (collectorPluginState.plugin_slug !== input.pluginSlug) {
          throw new Error(
            `Collector plugin state slug mismatch: expected ${input.pluginSlug}, got ${collectorPluginState.plugin_slug}`,
          );
        }

        const latestSnapshot = await transaction
          .selectFrom("collector_plugin_state_snapshots")
          .select(["version"])
          .where("collector_plugin_state_id", "=", collectorPluginState.id)
          .orderBy("version", "desc")
          .executeTakeFirst();

        await transaction
          .insertInto("collector_plugin_state_snapshots")
          .values({
            collector_plugin_state_id: collectorPluginState.id,
            id: uuidv7(),
            state: input.state,
            version: (latestSnapshot?.version ?? 0) + 1,
          })
          .executeTakeFirstOrThrow();
      });

      return ok(undefined);
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to save collector plugin state."),
      );
    }
  }
}
