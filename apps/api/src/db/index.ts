import { fileURLToPath } from "node:url";

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

export const MIGRATIONS_FOLDER = fileURLToPath(
  new URL("../../migrations", import.meta.url),
);

export function createDb(connectionString: string): { db: Db; pool: Pool } {
  const pool = new Pool({ connectionString, max: 10 });
  const db = drizzle({ client: pool, schema });
  return { db, pool };
}

export async function migrateDb(db: Db): Promise<void> {
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}
