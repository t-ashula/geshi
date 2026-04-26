export interface RuntimeConfig {
  backendPort: number;
  pgDatabase: string;
  pgHost: string;
  pgPassword: string;
  pgPort: number;
  pgUser: string;
}

export function getRuntimeConfig(): RuntimeConfig {
  return {
    backendPort: Number(process.env.PORT ?? "3000"),
    pgDatabase: process.env.PGDATABASE ?? "geshi",
    pgHost: process.env.PGHOST ?? "127.0.0.1",
    pgPassword: process.env.PGPASSWORD ?? "geshi",
    pgPort: Number(process.env.PGPORT ?? "55432"),
    pgUser: process.env.PGUSER ?? "geshi",
  };
}
