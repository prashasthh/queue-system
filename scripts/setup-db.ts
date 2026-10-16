import { getDb, migrate } from "../lib/db";
async function main() {
  const db = await getDb();
  await migrate(db);
  console.log("Database migrations and demo menu ready.");
  await db.close();
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
