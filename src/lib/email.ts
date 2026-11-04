// The one rule for emails: the sign-in form, the server and the migration of existing data all use it.
// No "server-only": the form in the browser checks the address with the same schema.

import { z } from "zod";

export const INVALID_EMAIL_MESSAGE = "Проверь адрес почты";

// Trims spaces around the address, lowercases it (Anna@Example.COM is anna@example.com) and checks the format.
export const emailSchema = z
  .string({ error: INVALID_EMAIL_MESSAGE })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: INVALID_EMAIL_MESSAGE }));

// The normalized address, or null if it is not an email.
export function normalizeEmail(value: unknown): string | null {
  const result = emailSchema.safeParse(value);
  return result.success ? result.data : null;
}
