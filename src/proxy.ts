import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth";

// A convenience, not the protection: the protection is requireUser() at the start of every page and action.
// - Without a session cookie a visitor goes straight to the sign-in page.
// - With one, the session is asked for here: that renews the 30 days from the last visit (at most once a
//   day) and hands the renewed cookie to the browser. Server components cannot write cookies, so they
//   cannot renew the session themselves.
export async function proxy(request: NextRequest) {
  const hasSessionCookie = request.cookies.getAll().some((cookie) => cookie.name.endsWith("session_token"));
  if (!hasSessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const session = await auth.api.getSession({ headers: request.headers, asResponse: true });
  const response = NextResponse.next();
  for (const cookie of session.headers.getSetCookie()) {
    response.headers.append("set-cookie", cookie);
  }
  return response;
}

export const config = {
  // Everything except the sign-in page, the sign-in handler, the deploy check, Next.js internals and files.
  matcher: ["/((?!login(?:/|$)|api/auth(?:/|$)|health(?:/|$)|_next/|favicon\\.ico$|.*\\..*).*)"],
};
