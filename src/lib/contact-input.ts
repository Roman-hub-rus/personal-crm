import { z } from "zod";

import type { ContactFrequency } from "@/db/schema";

import { daysInMonth, type CalendarDate } from "./birthdays";
import { CONTACT_FREQUENCIES } from "./contact-frequency";
import { groupNameSchema } from "./contact-groups";

// Shared by the form (client) and server actions. Messages are shown to the user, hence Russian.

// "frequency" is a string in the form too: "" means "Не задано". So are the three parts of the birthday:
// "" means empty.
export const CONTACT_FIELDS = [
  "name",
  "about",
  "howWeMet",
  "phone",
  "email",
  "frequency",
  "birthDay",
  "birthMonth",
  "birthYear",
  "notes",
] as const;

// The parts of the birthday share one error, shown under the whole field.
const BIRTHDAY_FIELDS: readonly string[] = ["birthDay", "birthMonth", "birthYear"];

export type ContactField = (typeof CONTACT_FIELDS)[number];
export type ContactFormValues = Record<ContactField, string> & {
  // Groups already in the database (picked by id) and groups typed but not yet created.
  groupIds: number[];
  newGroups: string[];
};
export type FieldErrors = Partial<Record<Exclude<ContactField, "birthDay" | "birthMonth" | "birthYear">, string>> & {
  birthday?: string;
  groups?: string;
};

const optionalText = (max: number, tooLongMessage: string) =>
  z
    .string()
    .trim()
    .max(max, tooLongMessage)
    .transform((value) => (value === "" ? null : value));

function withoutDuplicates<T>(toKey: (value: T) => string) {
  return (values: T[]) => new Set(values.map(toKey)).size === values.length;
}

export const MIN_BIRTH_YEAR = 1900;

type Birthday = { birthDay: number | null; birthMonth: number | null; birthYear: number | null };

const wholeNumber = (value: string) => (/^\d+$/.test(value) ? Number(value) : NaN);

// Checks the three parts of the birthday against today's date (in the app's time zone).
// Returns the values to store or the message shown under the field.
export function parseBirthday(
  day: string,
  month: string,
  year: string,
  today: CalendarDate,
): { ok: true; value: Birthday } | { ok: false; message: string } {
  [day, month, year] = [day.trim(), month.trim(), year.trim()];
  if (day === "" && month === "" && year === "") {
    return { ok: true, value: { birthDay: null, birthMonth: null, birthYear: null } };
  }
  if (day === "" || month === "") {
    return { ok: false, message: "Укажите и день, и месяц" };
  }

  const birthYear = year === "" ? null : wholeNumber(year);
  if (birthYear !== null && !(birthYear >= MIN_BIRTH_YEAR && birthYear <= today.year)) {
    return { ok: false, message: `Проверьте год — от ${MIN_BIRTH_YEAR} до ${today.year}` };
  }

  const birthDay = wholeNumber(day);
  const birthMonth = wholeNumber(month);
  // Without a year, 29 February is a valid date: such people celebrate on 28 February in other years.
  const lastDay = birthMonth >= 1 && birthMonth <= 12 ? daysInMonth(birthYear ?? 2000, birthMonth) : 0;
  if (!(birthDay >= 1 && birthDay <= lastDay)) {
    return { ok: false, message: "Такой даты нет — проверьте день и месяц" };
  }

  if (birthYear === today.year && (birthMonth > today.month || (birthMonth === today.month && birthDay > today.day))) {
    return { ok: false, message: "Дата рождения не может быть в будущем" };
  }

  return { ok: true, value: { birthDay, birthMonth, birthYear } };
}

const contactFieldsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Укажите имя — по нему контакт можно будет найти")
    .max(200, "Имя слишком длинное — не больше 200 символов"),
  about: optionalText(500, "Слишком длинно — не больше 500 символов"),
  howWeMet: optionalText(1000, "Слишком длинно — не больше 1000 символов"),
  phone: optionalText(50, "Слишком длинный номер — не больше 50 символов"),
  email: optionalText(254, "Слишком длинный адрес").refine(
    (value) => value === null || z.email().safeParse(value).success,
    "Проверьте адрес — похоже, в нём опечатка. Пример: name@example.com",
  ),
  frequency: z
    .enum(["", ...CONTACT_FREQUENCIES], "Выберите, как часто общаться, из списка")
    .transform((value) => (value === "" ? null : value)),
  notes: optionalText(50_000, "Заметки слишком длинные — не больше 50 000 символов"),
  groupIds: z.array(z.number().int().positive()).refine(
    withoutDuplicates<number>((id) => String(id)),
    "Повторяющиеся группы",
  ),
  newGroups: z.array(groupNameSchema).refine(
    withoutDuplicates<string>((name) => name.toLowerCase()),
    "Повторяющиеся группы",
  ),
});

// "Today" is passed in: the check of a date in the future and the latest valid year depend on it.
// The birthday is a separate schema in an intersection, so its error is reported together with the errors
// of other fields (a refinement of the whole object would be skipped while any field is invalid).
export function contactInputSchema(today: CalendarDate) {
  const birthdaySchema = z
    .object({ birthDay: z.string(), birthMonth: z.string(), birthYear: z.string() })
    .transform(({ birthDay, birthMonth, birthYear }, ctx) => {
      const birthday = parseBirthday(birthDay, birthMonth, birthYear, today);
      if (!birthday.ok) {
        ctx.addIssue({ code: "custom", message: birthday.message, path: ["birthday"] });
        return z.NEVER;
      }
      return birthday.value;
    });
  return z.intersection(contactFieldsSchema, birthdaySchema);
}

export type ContactInput = z.output<ReturnType<typeof contactInputSchema>>;

export const EMPTY_CONTACT_FORM: ContactFormValues = {
  name: "",
  about: "",
  howWeMet: "",
  phone: "",
  email: "",
  frequency: "",
  birthDay: "",
  birthMonth: "",
  birthYear: "",
  notes: "",
  groupIds: [],
  newGroups: [],
};

type StoredContact = {
  [K in Exclude<ContactField, "frequency" | "birthDay" | "birthMonth" | "birthYear">]: string | null;
} & {
  contactFrequency: ContactFrequency | null;
  birthDay: number | null;
  birthMonth: number | null;
  birthYear: number | null;
  groups: { id: number }[];
};

export function toFormValues(contact: StoredContact): ContactFormValues {
  return {
    name: contact.name ?? "",
    about: contact.about ?? "",
    howWeMet: contact.howWeMet ?? "",
    phone: contact.phone ?? "",
    email: contact.email ?? "",
    frequency: contact.contactFrequency ?? "",
    birthDay: contact.birthDay?.toString() ?? "",
    birthMonth: contact.birthMonth?.toString() ?? "",
    birthYear: contact.birthYear?.toString() ?? "",
    notes: contact.notes ?? "",
    groupIds: contact.groups.map((group) => group.id),
    newGroups: [],
  };
}

export function toFieldErrors(error: z.ZodError): FieldErrors {
  const result: FieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (field === "birthday" || (typeof field === "string" && BIRTHDAY_FIELDS.includes(field))) {
      result.birthday ??= issue.message;
    } else if (typeof field === "string" && (CONTACT_FIELDS as readonly string[]).includes(field)) {
      result[field as keyof FieldErrors] ??= issue.message;
    } else if (field === "groupIds" || field === "newGroups") {
      result.groups ??= issue.message;
    }
  }
  return result;
}
