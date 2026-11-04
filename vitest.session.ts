// Sign-in for tests. The user and the session are real (created through Better Auth in the test database);
// only the way the request reaches the code is replaced: in a test there is no Next.js request, so the
// stub of next/headers (see vitest.setup.ts) hands out the cookie of the session made here.

import { makeSignature } from "better-auth/crypto";

let sessionCookie: string | null = null;

// Headers of the current "request": with the cookie of the user who signed in last, or without any.
export function getTestRequestHeaders(): Headers {
  const headers = new Headers();
  if (sessionCookie) headers.set("cookie", sessionCookie);
  return headers;
}

// Everything that follows in this test happens on behalf of this user. Creates the user if there is none.
// Call it again with another email to switch to another user, like a second device.
export async function signInAs(email: string) {
  // Loaded here, not at the top: this file is imported by the setup of every test file,
  // and tests that never sign in (e.g. migrations) should not load the app's database and auth.
  const { auth } = await import("@/lib/auth");
  const context = await auth.$context;
  const normalized = email.trim().toLowerCase();
  const found = await context.internalAdapter.findUserByEmail(normalized);
  const user =
    found?.user ??
    (await context.internalAdapter.createUser(
      { email: normalized, name: "", emailVerified: true },
      { method: "magic-link" },
    ));

  const session = await context.internalAdapter.createSession(user.id, false);
  const signedToken = `${session.token}.${await makeSignature(session.token, context.secret)}`;
  sessionCookie = `${context.authCookies.sessionToken.name}=${encodeURIComponent(signedToken)}`;
  return { user, session };
}

// A request without sign-in.
export function signOutTestUser() {
  sessionCookie = null;
}
