import { sql } from "drizzle-orm";
import { afterEach, describe, expect, test } from "vitest";

import { db } from "@/db";
import { extractSignInLink, findEmails, uniqueEmail, waitForEmails } from "../../../test-support/mailpit";
import { signInAs, signOutTestUser } from "../../../vitest.session";
import { requestSignInLink } from "./actions";

const SENT = (email: string) => ({ ok: true, email });
const TOO_OFTEN = { ok: false, error: "Слишком часто, попробуй через несколько минут" };
const BAD_EMAIL = { ok: false, error: "Проверь адрес почты" };

const smtpUrl = process.env.SMTP_URL;
afterEach(() => {
  process.env.SMTP_URL = smtpUrl;
});

// Moves the sending moment of the oldest email request of this address back in time.
async function makeOldestRequestOlderThan10Minutes(email: string) {
  await db.execute(sql`
    update sign_in_emails set sent_at = now() - interval '11 minutes'
    where id = (select min(id) from sign_in_emails where email = ${email})
  `);
}

describe("requesting a sign-in link", () => {
  test("Отправил ссылку", async () => {
    const email = uniqueEmail("anna");
    expect(await requestSignInLink(email)).toEqual(SENT(email));

    const emails = await waitForEmails(email);
    expect(emails).toHaveLength(1);
    expect(extractSignInLink(emails[0])).toContain("/api/auth/magic-link/verify?token=");
  });

  test("Новая и известная почта", async () => {
    const known = uniqueEmail("known");
    await signInAs(known);
    signOutTestUser();
    const fresh = uniqueEmail("fresh");

    // The same answer for both, so it cannot be used to find out who has an account.
    expect(await requestSignInLink(known)).toEqual(SENT(known));
    expect(await requestSignInLink(fresh)).toEqual(SENT(fresh));
    expect(await findEmails(known)).toHaveLength(1);
    expect(await findEmails(fresh)).toHaveLength(1);
  });

  test("Письмо не отправилось", async () => {
    const email = uniqueEmail("anna");
    // A port where nothing listens: the mail service is not available.
    process.env.SMTP_URL = "smtp://127.0.0.1:1";

    expect(await requestSignInLink(email)).toEqual({
      ok: false,
      error: "Не получилось отправить письмо, попробуй ещё раз",
    });
    process.env.SMTP_URL = smtpUrl;
    expect(await findEmails(email)).toHaveLength(0);
  });

  test("Пробелы по краям", async () => {
    const email = uniqueEmail("anna");
    expect(await requestSignInLink(`  ${email}  `)).toEqual(SENT(email));
    expect(await waitForEmails(email)).toHaveLength(1);
  });

  test("Большие буквы", async () => {
    const email = uniqueEmail("anna");
    const { user } = await signInAs(email);
    signOutTestUser();

    const upper = email.toUpperCase();
    expect(await requestSignInLink(upper)).toEqual(SENT(email));
    // The email goes to the same address, and the link signs in the same user, not a new one.
    const [message] = await waitForEmails(email);
    const { auth } = await import("@/lib/auth");
    const response = await auth.handler(new Request(extractSignInLink(message), { redirect: "manual" }));
    expect(response.headers.get("set-cookie")).toContain("session_token");

    const users = await db.execute<{ id: string }>(sql`select id from users`);
    expect(users).toHaveLength(1);
    expect(users[0].id).toBe(user.id);
  });

  test("Неверный адрес в форме", async () => {
    const result = await requestSignInLink("anna@");
    expect(result).toEqual(BAD_EMAIL);
    const [{ count }] = await db.execute<{ count: number }>(sql`select count(*)::int as count from sign_in_emails`);
    expect(count).toBe(0);
  });

  test("Пустое поле", async () => {
    expect(await requestSignInLink("")).toEqual(BAD_EMAIL);
    expect(await requestSignInLink("   ")).toEqual(BAD_EMAIL);
  });
});

describe("limit of 3 emails in 10 minutes", () => {
  async function requestThree(email: string) {
    for (let i = 0; i < 3; i++) {
      expect(await requestSignInLink(email)).toEqual(SENT(email));
    }
  }

  test("Четвёртое письмо", async () => {
    const email = uniqueEmail("anna");
    await requestThree(email);

    expect(await requestSignInLink(email)).toEqual(TOO_OFTEN);
    expect(await findEmails(email)).toHaveLength(3);
  });

  test("Прошло 10 минут", async () => {
    const email = uniqueEmail("anna");
    await requestThree(email);
    await makeOldestRequestOlderThan10Minutes(email);

    expect(await requestSignInLink(email)).toEqual(SENT(email));
    expect(await waitForEmails(email, 4)).toHaveLength(4);
  });

  test("Другая почта", async () => {
    const a = uniqueEmail("a");
    const b = uniqueEmail("b");
    await requestThree(a);

    expect(await requestSignInLink(b)).toEqual(SENT(b));
    expect(await waitForEmails(b)).toHaveLength(1);
  });

  test("Та же почта другими буквами", async () => {
    const email = uniqueEmail("anna");
    await requestThree(email);

    expect(await requestSignInLink(` ${email.toUpperCase()} `)).toEqual(TOO_OFTEN);
    expect(await findEmails(email)).toHaveLength(3);
  });

  test("Письмо не отправилось тоже считается попыткой", async () => {
    const email = uniqueEmail("anna");
    process.env.SMTP_URL = "smtp://127.0.0.1:1";
    for (let i = 0; i < 3; i++) {
      expect((await requestSignInLink(email)).ok).toBe(false);
    }
    process.env.SMTP_URL = smtpUrl;

    // The mail service came back, but the limit is already used up by the failed attempts.
    expect(await requestSignInLink(email)).toEqual(TOO_OFTEN);
  });
});

describe("the sign-in email", () => {
  test("Что в письме", async () => {
    const email = uniqueEmail("anna");
    await requestSignInLink(email);

    const [message] = await waitForEmails(email);
    expect(message.from.name).toBe("Личная CRM");
    expect(message.from.address).toBe(process.env.MAIL_FROM);
    expect(message.subject).toBe("Вход в Личную CRM");
    expect(message.html).toContain("Войти");
    expect(message.html).toContain("Ссылка работает 15 минут");
    expect(message.html).toContain("Если вы не запрашивали вход - просто проигнорируйте письмо");
    expect(message.text).toContain("Если вы не запрашивали вход - просто проигнорируйте письмо");
  });
});
