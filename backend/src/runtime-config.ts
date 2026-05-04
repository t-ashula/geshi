export interface RuntimeConfig {
  backendPort: number;
  pgDatabase: string;
  pgHost: string;
  pgPassword: string;
  pgPort: number;
  pgUser: string;
  scribeBaseUrl: string;
  storageRootDir: string;
  workStorageRootDir: string;
}

export function getRuntimeConfig(): RuntimeConfig {
  return {
    backendPort: Number(process.env.PORT ?? "3000"),
    pgDatabase: process.env.PGDATABASE ?? "geshi",
    pgHost: process.env.PGHOST ?? "127.0.0.1",
    pgPassword: process.env.PGPASSWORD ?? "geshi",
    pgPort: Number(process.env.PGPORT ?? "55432"),
    pgUser: process.env.PGUSER ?? "geshi",
    scribeBaseUrl:
      process.env.GESHI_SCRIBE_BASE_URL ?? "http://127.0.0.1:58000",
    storageRootDir: process.env.GESHI_STORAGE_ROOT_DIR ?? ".data/storage",
    workStorageRootDir:
      process.env.GESHI_WORK_STORAGE_ROOT_DIR ?? ".data/work-storage",
  };
}
