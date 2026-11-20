import "dotenv/config";
import { db, pool } from "../src/db";
import {
  employees,
  records,
  sessions,
  uploads,
  settings,
  backups,
} from "../src/db/schema";
async function main() {
  if (process.env.DZ_TEST_EMPTY_DB !== "1")
    throw new Error("Refusing cleanup: DZ_TEST_EMPTY_DB=1 is required.");
  const accounts = await db.select().from(employees);
  if (!accounts.length || accounts.some((u) => !u.username.startsWith("qa-")))
    throw new Error("Refusing cleanup: non-test accounts found.");
  await db.transaction(async (tx) => {
    await tx.delete(sessions);
    await tx.delete(records);
    await tx.delete(uploads);
    await tx.delete(settings);
    await tx.delete(backups);
    await tx.delete(employees);
  });
  console.log(
    "Temporary QA fixtures removed. Application returned to first-time setup.",
  );
  await pool.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
