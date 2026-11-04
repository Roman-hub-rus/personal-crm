import { inspect } from "node:util";

import { describe, expect, test } from "vitest";

import { db } from "@/db";
import { contacts, groups } from "@/db/schema";

// Everything a log line of a failed query could show: Next.js prints the message, the stack and
// every field of the error, including its cause.
function everythingLogged(error: unknown): string {
  return [
    String(error),
    error instanceof Error ? error.stack : "",
    inspect(error, { depth: null, showHidden: true }),
  ].join("\n");
}

async function caught(query: PromiseLike<unknown>): Promise<unknown> {
  try {
    await query;
  } catch (error) {
    return error;
  }
  throw new Error("The query was expected to fail");
}

const ivan = {
  name: "Иван Петров",
  about: "Архитектор из Казани",
  howWeMet: "На конференции в Сочи",
  phone: "+7 999 123-45-67",
  email: "ivan.petrov@example.com",
  notes: "Обещал прислать книгу про сады",
};

// No name: the insert fails on the not-null constraint, and Postgres puts this whole row into the
// error detail ("Failing row contains (…)"), while Ivan's values travel as query parameters.
const maria = {
  name: null as unknown as string,
  about: "Сестра Ивана",
  howWeMet: "Познакомил Иван на дне рождения",
  phone: "+7 912 765-43-21",
  email: "maria.petrova@example.com",
  notes: "День рождения 12 марта",
};

const personalValues = [...Object.values(ivan), ...Object.values(maria).filter((value) => value !== null)];

function expectNoPersonalData(error: unknown) {
  const logged = everythingLogged(error);
  for (const value of personalValues) {
    expect(logged).not.toContain(value);
  }
}

describe("Сбой запроса к базе", () => {
  test("Сбой при сохранении контакта: в ошибке нет имени, телефона, почты и заметок", async () => {
    const error = await caught(db.insert(contacts).values([ivan, maria]));

    expectNoPersonalData(error);
    expect(error).toMatchObject({ code: "23502" });
    expect(everythingLogged(error)).toContain('insert into "contacts"');
  });

  test("То же внутри транзакции", async () => {
    const error = await caught(
      db.transaction(async (tx) => {
        await tx.insert(contacts).values([ivan, maria]);
      }),
    );

    expectNoPersonalData(error);
    expect(error).toMatchObject({ code: "23502" });
  });

  test("Повтор названия группы: код ошибки на месте, названия в ошибке нет", async () => {
    await db.insert(groups).values({ name: "Семья Ивановых" });

    const error = await caught(db.insert(groups).values({ name: "семья ивановых" }));

    const logged = everythingLogged(error);
    expect(logged).not.toContain("Семья Ивановых");
    expect(logged).not.toContain("семья ивановых");
    expect(error).toMatchObject({ code: "23505" });
    expect(logged).toContain("groups_lower_name_idx");
  });
});
