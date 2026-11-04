import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";

// Sign-in by a link from the email: requesting the link, opening it, the session and sign-out.
export const { GET, POST } = toNextJsHandler(auth);
