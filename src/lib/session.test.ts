import { sql } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import { db } from "@/db";
import { signInAs, signOutTestUser } from "../../vitest.session";
import { getCurrentUser, requireUser } from "./session";

const DAY_MS = 24 * 60 * 60 * 1000;

// What Next.js's redirect() throws: an error whose digest holds the target address.
async function redirectTarget(action: () => Promise<unknown>): Promise<string | null> {
  try {
    await action();
  } catch (error) {
    const digest = (error as { digest?: unknown }).digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
      return digest.split(";")[2];
    }
    throw error;
  }
  return null;
}

describe("session", () => {
  test("getCurrentUser after signInAs is that user", async () => {
    const { user } = await signInAs("anna@example.com");
    const current = await getCurrentUser();
    expect(current?.id).toBe(user.id);
    expect(current?.email).toBe("anna@example.com");
  });

  test("getCurrentUser without sign-in is null", async () => {
    expect(await getCurrentUser()).toBeNull();
  });

  test("getCurrentUser after signing in as another user is the other user", async () => {
    await signInAs("anna@example.com");
    await signInAs("boris@example.com");
    expect((await getCurrentUser())?.email).toBe("boris@example.com");
  });

  test("requireUser without sign-in redirects to the sign-in page", async () => {
    signOutTestUser();
    expect(await redirectTarget(() => requireUser())).toBe("/login");
  });

  test("requireUser with sign-in returns the user", async () => {
    const { user } = await signInAs("anna@example.com");
    expect((await requireUser()).id).toBe(user.id);
  });

  test("the session lives 30 days", async () => {
    await signInAs("anna@example.com");
    const [row] = await db.execute<{ expires_at: Date }>(sql`select expires_at from sessions`);
    const lifetime = new Date(row.expires_at).getTime() - Date.now();
    // About 30 days from now (a minute of slack for the test itself).
    expect(Math.abs(lifetime - 30 * DAY_MS)).toBeLessThan(60 * 1000);
  });
});
