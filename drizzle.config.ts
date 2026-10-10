import { defineConfig } from "drizzle-kit";

import { getDatabaseUrl, loadEnv } from "./src/db/env";

loadEnv();

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: getDatabaseUrl() },
  strict: true,
  verbose: true,
});
