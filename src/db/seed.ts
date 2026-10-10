// Fills an empty database with test contacts: `pnpm db:seed` (1000 by default) or `pnpm db:seed 250`.
// Never touches existing data: if the contacts table is not empty, the script exits without changes.

import { getDatabaseUrl, loadEnv } from "./env";
import { seedContacts } from "./seed-contacts";

async function main() {
  loadEnv();
  const amount = Number(process.argv[2] ?? 1000);
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error(`Invalid amount: "${process.argv[2]}". Pass a positive integer.`);
  }

  const { inserted, existing } = await seedContacts(getDatabaseUrl(), amount);
  if (inserted === 0) {
    console.log(`Seed skipped: the contacts table already has ${existing} rows, nothing was changed.`);
  } else {
    console.log(`Seed done: inserted ${inserted} test contacts.`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
