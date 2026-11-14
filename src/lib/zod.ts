// Zod for the whole app: import `z` from here, not from "zod".
// `jitless` stops zod from probing `new Function` (a speed-up it tries on first use). The Content-Security-Policy
// in next.config.ts has no 'unsafe-eval', so the probe would show up as a CSP error in the browser console.
// The setting must run before any schema is built, which importing `z` from this module guarantees.

import { z } from "zod";

z.config({ jitless: true });

export { z };
