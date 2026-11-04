// The sign-in rules as the server enforces them, without the form: requests go straight to the handler
// of Better Auth (the same /api/auth/... address that is open on the internet) and links are opened there.

import { sql } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import { db } from "@/db";
import { extractSignInLink, findEmails, uniqueEmail, waitForEmails } from "../../test-support/mailpit";
import { auth } from "./auth";

const BASE_URL = process.env.BETTER_AUTH_URL!;

// A request for a sign-in link that did not come from the form.
function requestLinkDirectly(email: unknown) {
  return auth.handler(
    new Request(`${BASE_URL}/api/auth/sign-in/magic-link`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE_URL },
      body: JSON.stringify({ email }),
    }),
  );
}

// Opens a link from an email as the browser does, without following the redirect.
function openLink(link: string) {
  return auth.handler(new Request(link, { redirect: "manual" }));
}

// Did the browser get signed in? The session cookie is set only on a successful sign-in.
function signedIn(response: Response) {
  return (response.headers.get("set-cookie") ?? "").includes("session_token");
}

async function requestAndGetLink(email: string, count = 1) {
  for (let i = 0; i < count; i++) {
    const response = await requestLinkDirectly(email);
    expect(response.status).toBe(200);
  }
  const emails = await waitForEmails(email, count);
  return emails.map(extractSignInLink);
}

describe("requests not from the form", () => {
  test("Неверный адрес не из формы", async () => {
    for (const email of ["anna@", "", "not an email", 42]) {
      const response = await requestLinkDirectly(email);
      expect(response.status).toBe(400);
    }
    const [{ count }] = await db.execute<{ count: number }>(sql`select count(*)::int as count from sign_in_emails`);
    expect(count).toBe(0);
  });

  test("Лишний запрос не из формы", async () => {
    const email = uniqueEmail("anna");
    for (let i = 0; i < 3; i++) {
      expect((await requestLinkDirectly(email)).status).toBe(200);
    }

    const fourth = await requestLinkDirectly(email);
    expect(fourth.status).toBe(429);
    expect(await findEmails(email)).toHaveLength(3);
  });

  test("Прямой запрос не уводит человека на другой адрес", async () => {
    const email = uniqueEmail("anna");
    const response = await auth.handler(
      new Request(`${BASE_URL}/api/auth/sign-in/magic-link`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: BASE_URL },
        body: JSON.stringify({ email, callbackURL: "/contacts/new", errorCallbackURL: "/somewhere-else" }),
      }),
    );
    expect(response.status).toBe(200);

    const [link] = (await waitForEmails(email)).map(extractSignInLink);
    const url = new URL(link);
    expect(url.searchParams.get("callbackURL")).toBe("/");
    expect(url.searchParams.get("errorCallbackURL")).toBe("/login");
  });
});

describe("the link", () => {
  test("Открыл ссылку", async () => {
    const email = uniqueEmail("anna");
    const [link] = await requestAndGetLink(email);

    const response = await openLink(link);
    expect(signedIn(response)).toBe(true);
    expect(new URL(response.headers.get("location")!, BASE_URL).pathname).toBe("/");
  });

  test("Первый вход", async () => {
    const email = uniqueEmail("anna");
    const [link] = await requestAndGetLink(email);
    const usersBefore = await db.execute(sql`select 1 from users where email = ${email}`);
    expect(usersBefore).toHaveLength(0);

    await openLink(link);

    // The first sign-in is the registration: the user appears, with no questions asked (no name).
    const users = await db.execute<{ name: string; email_verified: boolean }>(
      sql`select name, email_verified from users where email = ${email}`,
    );
    expect(users).toHaveLength(1);
    expect(users[0].name).toBe("");
    expect(users[0].email_verified).toBe(true);
  });

  test("Использованная ссылка", async () => {
    const email = uniqueEmail("anna");
    const [link] = await requestAndGetLink(email);

    expect(signedIn(await openLink(link))).toBe(true);

    const again = await openLink(link);
    expect(signedIn(again)).toBe(false);
    expect(new URL(again.headers.get("location")!, BASE_URL).pathname).toBe("/login");
    expect(new URL(again.headers.get("location")!, BASE_URL).searchParams.get("error")).toBeTruthy();
  });

  test("Ссылке больше 15 минут", async () => {
    const email = uniqueEmail("anna");
    const [link] = await requestAndGetLink(email);

    // The new link lives about 15 minutes.
    const [{ lifetime }] = await db.execute<{ lifetime: number }>(
      sql`select extract(epoch from (max(expires_at) - now()))::float as lifetime from verifications`,
    );
    expect(Math.abs(lifetime - 15 * 60)).toBeLessThan(30);

    // 16 minutes later it no longer works.
    await db.execute(sql`update verifications set expires_at = now() - interval '1 minute'`);
    const response = await openLink(link);
    expect(signedIn(response)).toBe(false);
    expect(new URL(response.headers.get("location")!, BASE_URL).pathname).toBe("/login");
    expect(new URL(response.headers.get("location")!, BASE_URL).searchParams.get("error")).toBeTruthy();
  });

  test("Запросил новую ссылку", async () => {
    const email = uniqueEmail("anna");
    const [first, second] = await requestAndGetLink(email, 2);

    const oldOne = await openLink(first);
    expect(signedIn(oldOne)).toBe(false);
    expect(new URL(oldOne.headers.get("location")!, BASE_URL).pathname).toBe("/login");

    expect(signedIn(await openLink(second))).toBe(true);
  });

  test("Новая ссылка одной почты не гасит ссылки другой", async () => {
    const a = uniqueEmail("a");
    const b = uniqueEmail("b");
    const [linkA] = await requestAndGetLink(a);
    await requestAndGetLink(b);

    expect(signedIn(await openLink(linkA))).toBe(true);
  });
});
