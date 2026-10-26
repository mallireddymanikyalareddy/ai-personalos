import { sql } from "drizzle-orm";
import type { Pool } from "pg";

import { buildApp, type ReadinessCheck } from "./app";
import { loadConfig } from "./config";
import { createDb, migrateDb, type Db } from "./db/index";

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const checks: ReadinessCheck[] = [];
  let db: Db | undefined;
  let pool: Pool | undefined;
  let closeLocal: (() => Promise<void>) | undefined;

  if (!config.DATABASE_URL && process.env.PGLITE_DATA_DIR) {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const schema = await import("./db/schema");
    const { MIGRATIONS_FOLDER } = await import("./db/index");
    const client = new PGlite(process.env.PGLITE_DATA_DIR);
    closeLocal = () => client.close();
    const local = drizzle({ client, schema });
    await migrate(local, { migrationsFolder: MIGRATIONS_FOLDER });
    db = local as unknown as Db;
    const database = db;
    checks.push({
      name: "database",
      run: async () => {
        await database.execute(sql`select 1`);
      },
    });
  } else if (config.DATABASE_URL) {
    ({ db, pool } = createDb(config.DATABASE_URL));
    if (config.NODE_ENV === "production") {
      console.warn(
        "DATABASE_URL set: run `npm run db:migrate --workspace @personalos/api` before serving traffic.",
      );
    } else {
      await migrateDb(db);
    }
    const database = db;
    checks.push({
      name: "database",
      run: async () => {
        await database.execute(sql`select 1`);
      },
    });
  }

  const app = await buildApp({ config, checks, db });

  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info({ signal }, "shutting down");
    void app
      .close()
      .then(async () => {
        if (pool) await pool.end();
        if (closeLocal) await closeLocal();
      })
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  await app.listen({ host: config.HOST, port: config.PORT });
  app.log.info(
    { host: config.HOST, port: config.PORT, env: config.NODE_ENV },
    "personalos api listening",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
