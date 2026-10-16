import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";
import { readFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";

export interface Sql {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<T[]>;
}
export interface Database extends Sql {
  transaction<T>(fn: (tx: Sql) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
type DbGlobal = typeof globalThis & { tablelineDb?: Promise<Database> };
const globals = globalThis as DbGlobal;

async function connect(): Promise<Database> {
  if ((process.env.DB_PROVIDER || "pglite") === "postgres") {
    if (!process.env.DATABASE_URL)
      throw new Error("DATABASE_URL is required for postgres mode.");
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 5000,
      query_timeout: 15000,
      ssl:
        process.env.DATABASE_SSL === "false"
          ? false
          : { rejectUnauthorized: true },
    });
    pool.on("error", () =>
      console.error(
        "[database] Idle connection lost; the pool will reconnect.",
      ),
    );
    return {
      query: async <T>(sql: string, params?: unknown[]) =>
        (await pool.query(sql, params)).rows as T[],
      async transaction<T>(fn: (tx: Sql) => Promise<T>) {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const result = await fn({
            query: async <R>(sql: string, params?: unknown[]) =>
              (await client.query(sql, params)).rows as R[],
          });
          await client.query("COMMIT");
          return result;
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }
      },
      close: () => pool.end(),
    };
  }
  if (process.env.DB_PROVIDER && process.env.DB_PROVIDER !== "pglite")
    throw new Error("Unsupported DB_PROVIDER");
  const dataDir =
    process.env.PGLITE_DATA_DIR ||
    path.join(process.cwd(), ".data", "tableline");
  if (dataDir !== "memory://") await mkdir(dataDir, { recursive: true });
  const pg = new PGlite(dataDir);
  await pg.waitReady;
  const db: Database = {
    query: async <T>(sql: string, params?: unknown[]) =>
      (await pg.query<T>(sql, params)).rows,
    transaction: (fn) =>
      pg.transaction((tx) =>
        fn({
          query: async <T>(sql: string, params?: unknown[]) =>
            (await tx.query<T>(sql, params)).rows,
        }),
      ),
    close: () => pg.close(),
  };
  await migrate(db);
  return db;
}
export function getDb(): Promise<Database> {
  globals.tablelineDb ??= connect().catch((error) => {
    globals.tablelineDb = undefined;
    throw error;
  });
  return globals.tablelineDb;
}
export async function migrate(db: Database) {
  await db.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations(version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  await db.transaction(async (tx) => {
    await tx.query("LOCK TABLE schema_migrations IN EXCLUSIVE MODE");
    const directory = path.join(process.cwd(), "supabase/migrations");
    for (const file of (await readdir(directory))
      .filter((f) => /^\d+_.+\.sql$/.test(f))
      .sort()) {
      const version = file.replace(/\.sql$/, "");
      const applied = await tx.query(
        "SELECT version FROM schema_migrations WHERE version=$1",
        [version],
      );
      if (applied.length) continue;
      const migration = await readFile(path.join(directory, file), "utf8");
      // These checked-in migrations contain no procedural blocks or semicolons inside strings.
      for (const statement of migration.split(";").filter((s) => s.trim()))
        await tx.query(statement);
      await tx.query(
        "INSERT INTO schema_migrations(version) VALUES($1) ON CONFLICT DO NOTHING",
        [version],
      );
    }
    const seed = await readFile(
      path.join(process.cwd(), "supabase/seed.sql"),
      "utf8",
    );
    for (const statement of seed.split(";").filter((s) => s.trim()))
      await tx.query(statement);
  });
}
