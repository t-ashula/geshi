import type { ColumnType } from "kysely";

type TimestampColumn = ColumnType<Date, Date | string | undefined, never>;

export type SourceTable = {
  created_at: TimestampColumn;
  id: string;
  kind: "podcast";
  slug: string;
  url: string;
  url_hash: string;
};

export type SourceSnapshotTable = {
  description: string | null;
  id: string;
  recorded_at: TimestampColumn;
  source_id: string;
  title: string | null;
  version: number;
};

export type GeshiDatabase = {
  source_snapshots: SourceSnapshotTable;
  sources: SourceTable;
};
