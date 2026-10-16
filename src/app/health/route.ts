import { sql } from "drizzle-orm";

import { db } from "@/db";

// Health check for deploys: 200 when the app is up and can reach the database, 503 otherwise.
// `version` is the git commit the running image was built from (APP_VERSION is set in the Dockerfile).
export const dynamic = "force-dynamic";

export async function GET() {
  const version = process.env.APP_VERSION ?? "dev";
  try {
    await db.execute(sql`select 1`);
  } catch {
    return Response.json({ status: "error", version }, { status: 503 });
  }
  return Response.json({ status: "ok", version });
}
