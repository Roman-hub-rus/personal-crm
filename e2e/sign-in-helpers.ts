// Signing in from a browser the way a person does it: the form, the email in Mailpit, the link from it.
// Every address is made for one test (uniqueEmail), so the sending limit and the emails never overlap.

import { expect, type Page } from "@playwright/test";
import postgres from "postgres";

import { extractSignInLink, findEmails, waitForEmails } from "../test-support/mailpit";
import { getTestDatabaseUrl, splitTestDatabaseUrl } from "./test-database";

export { uniqueEmail } from "../test-support/mailpit";

// Types the address into the form, presses "Получить ссылку" and returns the link from the new email.
// Mailpit keeps the emails of earlier runs (the owner's address is the same in every run), so the new email
// is the one that comes after those already there.
export async function requestSignInLink(page: Page, email: string): Promise<string> {
  const previousEmails = (await findEmails(email)).length;
  await page.goto("/login");
  await page.getByLabel("Почта").fill(email);
  await page.getByRole("button", { name: "Получить ссылку" }).click();
  await expect(page.getByText(`Ссылка для входа отправлена на ${email}`)).toBeVisible();

  const emails = await waitForEmails(email, previousEmails + 1);
  return extractSignInLink(emails[emails.length - 1]);
}

// Signs the browser of this page in under this address and lands on the home page.
export async function signIn(page: Page, email: string) {
  const link = await requestSignInLink(page, email);
  await page.goto(link);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("user-email")).toHaveText(email);
}

let client: postgres.Sql | undefined;

// A connection to the e2e database, for tests that imitate passing time by moving moments in the past.
export function db(): postgres.Sql {
  if (!client) {
    const url = getTestDatabaseUrl();
    splitTestDatabaseUrl(url); // Throws unless this is the "*_e2e" database.
    client = postgres(url, { max: 1, onnotice: () => {} });
  }
  return client;
}

export async function closeSignInDatabase() {
  await client?.end();
  client = undefined;
}

// When the session of this user ends, in the database.
export async function sessionExpiresAt(email: string): Promise<Date> {
  const [row] = await db()<{ expiresAt: Date }[]>`
    select s.expires_at as "expiresAt" from sessions s join users u on u.id = s.user_id
    where u.email = ${email}
  `;
  expect(row, `session of ${email}`).toBeDefined();
  return row.expiresAt;
}

// Imitates that the last visit of this user was so long ago that the session ends in `interval` from now
// (a session lasts 30 days from the last visit: expires in 10 days means the last visit was 20 days ago).
export async function setSessionEndsIn(email: string, interval: string) {
  const result = await db()`
    update sessions set expires_at = now() + ${interval}::interval
    where user_id = (select id from users where email = ${email})
  `;
  expect(result.count, `sessions of ${email}`).toBeGreaterThan(0);
}
