import { loadConfig } from "../config";
import { createDb, migrateDb } from "./index";

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  if (!config.DATABASE_URL) {
    console.error("DATABASE_URL is required to run migrations.");
    process.exit(1);
  }
  const { db, pool } = createDb(config.DATABASE_URL);
  try {
    await migrateDb(db);
    console.log("migrations applied");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
