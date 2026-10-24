// SQL expressions for "Пора связаться", computed on read from the stored moments.
// No "server-only" here: the e2e test of the calendar arithmetic runs them as well.

import { sql, type SQLWrapper } from "drizzle-orm";

import { contacts } from "./schema";

type KeepInTouchSource = {
  frequency: SQLWrapper;
  lastNoteAt: SQLWrapper;
  lastContactedAt: SQLWrapper;
  frequencySetAt: SQLWrapper;
};

const contactColumns: KeepInTouchSource = {
  frequency: contacts.contactFrequency,
  lastNoteAt: contacts.lastNoteAt,
  lastContactedAt: contacts.lastContactedAt,
  frequencySetAt: contacts.frequencySetAt,
};

// Expressions over the contacts columns by default; tests pass literal values instead.
export function keepInTouchSql(source: KeepInTouchSource = contactColumns) {
  // greatest() skips NULLs and is NULL only when every argument is NULL.
  const lastContactAt = sql`greatest(${source.lastNoteAt}, ${source.lastContactedAt})`;
  const periodStart = sql`greatest(${source.lastNoteAt}, ${source.lastContactedAt}, ${source.frequencySetAt})`;
  // timestamptz + interval adds calendar months: January 31 + 1 month is the last day of February.
  const dueAt = sql`(${periodStart} + case ${source.frequency}
    when 'week' then interval '7 days'
    when 'month' then interval '1 month'
    when 'quarter' then interval '3 months'
    when 'year' then interval '1 year'
  end)`;
  return { lastContactAt, periodStart, dueAt };
}
