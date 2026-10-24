import { z } from "zod";

import type { ContactFrequency } from "@/db/schema";

import { CONTACT_FREQUENCIES } from "./contact-frequency";

// Shared by the form (client) and server actions. Messages are shown to the user, hence Russian.

// "frequency" is a string in the form too: "" means "Не задано".
export const CONTACT_FIELDS = ["name", "about", "howWeMet", "phone", "email", "frequency", "notes"] as const;

export type ContactField = (typeof CONTACT_FIELDS)[number];
export type ContactFormValues = Record<ContactField, string>;
export type FieldErrors = Partial<Record<ContactField, string>>;

const optionalText = (max: number, tooLongMessage: string) =>
  z
    .string()
    .trim()
    .max(max, tooLongMessage)
    .transform((value) => (value === "" ? null : value));

export const contactInputSchema = z.object({
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
});

export type ContactInput = z.output<typeof contactInputSchema>;

export const EMPTY_CONTACT_FORM: ContactFormValues = {
  name: "",
  about: "",
  howWeMet: "",
  phone: "",
  email: "",
  frequency: "",
  notes: "",
};

type StoredContact = { [K in Exclude<ContactField, "frequency">]: string | null } & {
  contactFrequency: ContactFrequency | null;
};

export function toFormValues(contact: StoredContact): ContactFormValues {
  return {
    name: contact.name ?? "",
    about: contact.about ?? "",
    howWeMet: contact.howWeMet ?? "",
    phone: contact.phone ?? "",
    email: contact.email ?? "",
    frequency: contact.contactFrequency ?? "",
    notes: contact.notes ?? "",
  };
}

export function toFieldErrors(error: z.ZodError): FieldErrors {
  const result: FieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && (CONTACT_FIELDS as readonly string[]).includes(field)) {
      result[field as ContactField] ??= issue.message;
    }
  }
  return result;
}
