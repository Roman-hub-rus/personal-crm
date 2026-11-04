import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";

import { db } from "@/db";
import { getAuthSecret, getAuthUrl } from "@/db/env";
import { accounts, sessions, users, verifications } from "@/db/schema";

import { emailSchema, INVALID_EMAIL_MESSAGE } from "./email";
import { sendMail } from "./mail";
import { buildSignInEmail } from "./sign-in-email";
import { registerSignInRequest, TooManyEmailsError } from "./sign-in-limit";

// Codes of the errors that the hook below answers with; the sign-in form turns them into texts.
export const SIGN_IN_ERROR = { invalidEmail: "INVALID_EMAIL", tooManyEmails: "TOO_MANY_EMAILS" } as const;

const MINUTE = 60;
const DAY = 24 * 60 * MINUTE;

// The one sign-in setup of the app: Better Auth with sign-in by a link from an email.
export const auth = betterAuth({
  baseURL: getAuthUrl(),
  secret: getAuthSecret(),
  database: drizzleAdapter(db, {
    provider: "pg",
    // Our tables are plural (users, sessions…), like contacts and groups.
    usePlural: true,
    schema: { users, sessions, accounts, verifications },
  }),
  session: {
    // A device stays signed in for 30 days after its last visit; a visit renews the term at most once a day.
    expiresIn: 30 * DAY,
    updateAge: DAY,
  },
  // No limit by IP address (owner's decision); the limit by email is in the "before" hook below.
  rateLimit: { enabled: false },
  telemetry: { enabled: false },
  hooks: {
    // The one place that checks a request for a sign-in link. The handler /api/auth/sign-in/magic-link is open
    // on the internet, so a request that bypasses the form comes through here, like the one from the form.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/magic-link") return;

      const parsed = emailSchema.safeParse(ctx.body?.email);
      if (!parsed.success) {
        throw new APIError("BAD_REQUEST", { code: SIGN_IN_ERROR.invalidEmail, message: INVALID_EMAIL_MESSAGE });
      }
      try {
        await registerSignInRequest(parsed.data);
      } catch (error) {
        if (error instanceof TooManyEmailsError) {
          throw new APIError("TOO_MANY_REQUESTS", { code: SIGN_IN_ERROR.tooManyEmails, message: error.message });
        }
        throw error;
      }

      // The addresses to go to are fixed here: a direct request cannot send the person anywhere else.
      return { context: { body: { email: parsed.data, callbackURL: "/", errorCallbackURL: "/login" } } };
    }),
  },
  plugins: [
    magicLink({
      // The link works for 15 minutes, once.
      expiresIn: 15 * MINUTE,
      // Links in the database are hashed: a copy of the database holds no working link.
      storeToken: "hashed",
      sendMagicLink: async ({ email, url }) => {
        await sendMail({ to: email, ...buildSignInEmail(url) });
      },
    }),
    // Must be the last plugin: it passes the cookies of the library to Next.js.
    nextCookies(),
  ],
});
