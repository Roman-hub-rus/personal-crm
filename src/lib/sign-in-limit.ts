import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { signInEmails } from "@/db/schema";

export const MAX_EMAILS = 3;
export const WINDOW_MINUTES = 10;

export class TooManyEmailsError extends Error {
  constructor() {
    super("Too many sign-in emails for this address.");
  }
}

// The one check for every request of a sign-in link, whether it came from the form or straight to the server:
// - at most 3 emails per address in 10 minutes, otherwise TooManyEmailsError and nothing is written;
// - the request is written down before the email is sent, so a failing mail service does not bypass the limit;
// - every earlier link of this address is dropped, so a new link makes the old ones useless.
// Expects the address already normalized (trimmed, lower case).
export async function registerSignInRequest(email: string) {
  await db.transaction(async (tx) => {
    // Two requests for one address at the same moment wait for each other, so both see the true count.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${email}))`);

    const [{ count }] = await tx.execute<{ count: number }>(sql`
      select count(*)::int as count from sign_in_emails
      where email = ${email} and sent_at > now() - make_interval(mins => ${WINDOW_MINUTES})
    `);
    if (count >= MAX_EMAILS) throw new TooManyEmailsError();

    await tx.insert(signInEmails).values({ email });
    // Old rows are not needed for the limit any more.
    await tx.execute(sql`
      delete from sign_in_emails
      where email = ${email} and sent_at <= now() - make_interval(mins => ${WINDOW_MINUTES})
    `);
    // Better Auth keeps a link as a row with identifier "magic-link:<hash>" and the email in the JSON value.
    await tx.execute(sql`
      delete from verifications
      where identifier like 'magic-link:%' and (value::jsonb) ->> 'email' = ${email}
    `);
  });
}
