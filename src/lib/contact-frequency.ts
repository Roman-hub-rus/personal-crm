import type { ContactFrequency } from "@/db/schema";

// Shared by the client (frequency select) and the server ("Пора связаться" rows).

export const CONTACT_FREQUENCIES = ["week", "month", "quarter", "year"] as const satisfies readonly ContactFrequency[];

export const FREQUENCY_NOT_SET_LABEL = "Не задано";

// Options of the frequency select.
export const FREQUENCY_OPTION_LABELS: Record<ContactFrequency, string> = {
  week: "Раз в неделю",
  month: "Раз в месяц",
  quarter: "Раз в квартал",
  year: "Раз в год",
};

// Inside a sentence: "Последнее общение 3 месяца назад · раз в месяц".
export const FREQUENCY_INLINE_LABELS: Record<ContactFrequency, string> = {
  week: "раз в неделю",
  month: "раз в месяц",
  quarter: "раз в квартал",
  year: "раз в год",
};

export function isContactFrequency(value: string): value is ContactFrequency {
  return (CONTACT_FREQUENCIES as readonly string[]).includes(value);
}
