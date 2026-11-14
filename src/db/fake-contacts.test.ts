import { createHash } from "node:crypto";

import { describe, expect, test } from "vitest";

import { APP_TIME_ZONE, daysInMonth, todayIn, upcomingBirthdays } from "@/lib/birthdays";

import { generateFakeContacts } from "./fake-contacts";

const NOW = new Date("2026-11-14T09:00:00.000Z");

// SHA-256 of generateFakeContacts(1000, default seed, NOW) before birthdays were added, see fingerprint().
const CONTACTS_WITHOUT_BIRTHDAYS = "b07f88f57f8ba23a6cc0832762eb670d1f988a547a70fdbc08e062e09653d4c1";

// The dates at the start of note lines ("04.09.2024 — …") are formatted in the machine's time zone, so they
// are left out: the fingerprint is the same on a developer's machine and in CI. The moments themselves
// (lastNoteAt and the others) are compared exactly.
function fingerprint(rows: ReturnType<typeof generateFakeContacts>) {
  const comparable = rows.map((contact) => {
    const rest = { ...contact };
    delete rest.birthDay;
    delete rest.birthMonth;
    delete rest.birthYear;
    return { ...rest, notes: rest.notes?.replace(/^\d{2}\.\d{2}\.\d{4} — /gm, "") ?? null };
  });
  return createHash("sha256").update(JSON.stringify(comparable)).digest("hex");
}

describe("generateFakeContacts: birthdays", () => {
  const contacts = generateFakeContacts(1000, undefined, NOW);
  const withBirthday = contacts.filter((contact) => contact.birthDay != null);

  test("детерминированы при одном зерне", () => {
    const again = generateFakeContacts(1000, undefined, NOW);
    expect(again.map(({ birthDay, birthMonth, birthYear }) => ({ birthDay, birthMonth, birthYear }))).toEqual(
      contacts.map(({ birthDay, birthMonth, birthYear }) => ({ birthDay, birthMonth, birthYear })),
    );
  });

  test("примерно у трети контактов, у части без года", () => {
    expect(withBirthday.length).toBeGreaterThan(250);
    expect(withBirthday.length).toBeLessThan(420);
    const withoutYear = withBirthday.filter((contact) => contact.birthYear == null);
    expect(withoutYear.length).toBeGreaterThan(withBirthday.length * 0.3);
    expect(withoutYear.length).toBeLessThan(withBirthday.length * 0.7);
  });

  test("несколько попадают в ближайшие 7 дней", () => {
    const rows = withBirthday.map((contact) => ({
      birthDay: contact.birthDay!,
      birthMonth: contact.birthMonth!,
      birthYear: contact.birthYear ?? null,
    }));
    const upcoming = upcomingBirthdays(rows, todayIn(APP_TIME_ZONE, NOW));
    expect(upcoming.length).toBeGreaterThanOrEqual(3);
    expect(upcoming.length).toBeLessThanOrEqual(15);

    // On any day of the year, not only on the fixed one.
    for (const now of [new Date("2027-02-27T22:00:00.000Z"), new Date("2026-12-29T12:00:00.000Z")]) {
      const other = generateFakeContacts(1000, undefined, now).filter((contact) => contact.birthDay != null);
      const otherRows = other.map((contact) => ({
        birthDay: contact.birthDay!,
        birthMonth: contact.birthMonth!,
        birthYear: contact.birthYear ?? null,
      }));
      expect(upcomingBirthdays(otherRows, todayIn(APP_TIME_ZONE, now)).length).toBeGreaterThanOrEqual(3);
    }
  });

  test("все даты верные", () => {
    const today = todayIn(APP_TIME_ZONE, NOW);
    for (const { birthDay, birthMonth, birthYear } of contacts) {
      if (birthDay == null) {
        expect(birthMonth ?? null).toBeNull();
        expect(birthYear ?? null).toBeNull();
        continue;
      }
      expect(birthMonth).toBeGreaterThanOrEqual(1);
      expect(birthMonth).toBeLessThanOrEqual(12);
      expect(birthDay).toBeGreaterThanOrEqual(1);
      expect(birthDay).toBeLessThanOrEqual(daysInMonth(birthYear ?? 2000, birthMonth!));
      if (birthYear != null) {
        expect(birthYear).toBeGreaterThanOrEqual(1900);
        expect(birthYear).toBeLessThan(today.year);
      }
    }
  });

  test("имена и остальные поля контактов не изменились", () => {
    expect(fingerprint(contacts)).toBe(CONTACTS_WITHOUT_BIRTHDAYS);
  });
});
