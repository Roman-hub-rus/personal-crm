"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth, SIGN_IN_ERROR } from "@/lib/auth";
import { INVALID_EMAIL_MESSAGE, normalizeEmail } from "@/lib/email";

import { SEND_FAILED_MESSAGE, TOO_MANY_EMAILS_MESSAGE } from "./messages";

export type RequestSignInLinkResult = { ok: true; email: string } | { ok: false; error: string };

// "Получить ссылку": sends the sign-in email. The answer is the same for a new address and a known one.
// The rules (format, limit, dropping the old links) are checked by the hook in auth.ts, not here,
// so a request that bypasses this form is checked in the same way.
export async function requestSignInLink(email: string): Promise<RequestSignInLinkResult> {
  // Spaces around the address would fail the library's own check before the hook sees the request.
  const normalized = normalizeEmail(email);
  if (!normalized) return { ok: false, error: INVALID_EMAIL_MESSAGE };

  try {
    await auth.api.signInMagicLink({ body: { email: normalized }, headers: await headers() });
    return { ok: true, email: normalized };
  } catch (error) {
    if (error instanceof APIError) {
      const code = (error.body as { code?: string } | undefined)?.code;
      if (code === SIGN_IN_ERROR.invalidEmail) return { ok: false, error: INVALID_EMAIL_MESSAGE };
      if (code === SIGN_IN_ERROR.tooManyEmails) return { ok: false, error: TOO_MANY_EMAILS_MESSAGE };
      // The library's own check of the address format.
      if (error.statusCode === 400) return { ok: false, error: INVALID_EMAIL_MESSAGE };
    }
    // Only the kind of the error is logged: the address of the person stays out of the log.
    console.error("Sign-in email was not sent:", error instanceof Error ? error.name : "unknown error");
    return { ok: false, error: SEND_FAILED_MESSAGE };
  }
}

// "Выйти": ends the sign-in on this device only (other devices stay signed in) and opens the sign-in page.
export async function signOut() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}
