"use server";

import { and, eq, inArray, or, sql, type SQLWrapper } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { contactGroups, contacts, groups } from "@/db/schema";
import type { GroupOption } from "@/lib/contact-groups";
import {
  contactInputSchema,
  toFieldErrors,
  toFormValues,
  type ContactFormValues,
  type FieldErrors,
} from "@/lib/contact-input";
import { formatDateTime } from "@/lib/format";

type Failure = { ok: false; fieldErrors?: FieldErrors; message?: string };

export type CreateContactResult = { ok: true; id: number; name: string } | Failure;

export type UpdateContactResult =
  | { ok: true; values: ContactFormValues; updatedAtLabel: string; allGroups: GroupOption[] }
  | Failure;

export type DeleteContactResult = { ok: true; name: string } | Failure;

// Moments go to the browser and back as exact text: a JS Date would drop the microseconds,
// and the undo would not find the moment it has to undo.
export type MarkContactedResult =
  | { ok: true; name: string; markedAt: string; previous: string | null }
  | Failure;

export type UndoMarkContactedResult = { ok: true; undone: boolean } | Failure;

const MOMENT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;

const exactMoment = (column: SQLWrapper) =>
  sql<string | null>`to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Creates groups typed but not yet saved (picking up an existing one case-insensitively instead
// of making a duplicate), drops ids of groups that were deleted in the meantime, and returns the
// final set of group ids the contact should belong to.
async function resolveGroupIds(tx: Tx, groupIds: number[], newGroups: string[]): Promise<number[]> {
  const validExistingIds = groupIds.length
    ? (await tx.select({ id: groups.id }).from(groups).where(inArray(groups.id, groupIds))).map((row) => row.id)
    : [];

  if (newGroups.length === 0) {
    return Array.from(new Set(validExistingIds));
  }

  await tx
    .insert(groups)
    .values(newGroups.map((name) => ({ name })))
    .onConflictDoNothing();
  const matchedByName = await tx
    .select({ id: groups.id })
    .from(groups)
    .where(or(...newGroups.map((name) => sql`lower(${groups.name}) = lower(${name})`)));

  return Array.from(new Set([...validExistingIds, ...matchedByName.map((row) => row.id)]));
}

async function saveContactGroups(tx: Tx, contactId: number, groupIds: number[]) {
  await tx.delete(contactGroups).where(eq(contactGroups.contactId, contactId));
  if (groupIds.length > 0) {
    await tx.insert(contactGroups).values(groupIds.map((groupId) => ({ contactId, groupId })));
  }
}

export async function createContact(input: unknown): Promise<CreateContactResult> {
  const parsed = contactInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: toFieldErrors(parsed.error) };
  }

  const { frequency, groupIds, newGroups, ...fields } = parsed.data;
  const created = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(contacts)
      .values({
        ...fields,
        contactFrequency: frequency,
        // All moments come from the database clock, like the "Пора связаться" query.
        lastNoteAt: fields.notes === null ? null : sql`now()`,
        frequencySetAt: frequency === null ? null : sql`now()`,
      })
      .returning({ id: contacts.id, name: contacts.name });

    const finalGroupIds = await resolveGroupIds(tx, groupIds, newGroups);
    await saveContactGroups(tx, created.id, finalGroupIds);
    return created;
  });

  revalidatePath("/");
  revalidatePath("/groups");
  return { ok: true, id: created.id, name: created.name };
}

export async function updateContact(id: number, input: unknown): Promise<UpdateContactResult> {
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, message: "Контакт не найден" };
  }

  const parsed = contactInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: toFieldErrors(parsed.error) };
  }

  // The moments are computed against the stored row in the same UPDATE, not against what the
  // form had loaded: the card may have been changed in another tab since.
  const { frequency, groupIds, newGroups, ...fields } = parsed.data;
  const result = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(contacts)
      .set({
        ...fields,
        contactFrequency: frequency,
        // Any change of the notes text counts as a note, including fixing or deleting old text.
        lastNoteAt: sql`case when ${contacts.notes} is distinct from ${fields.notes} then now() else ${contacts.lastNoteAt} end`,
        // Set when the frequency goes from "not set" to a value; switching between values keeps it.
        frequencySetAt:
          frequency === null
            ? null
            : sql`case when ${contacts.contactFrequency} is null then now() else ${contacts.frequencySetAt} end`,
      })
      .where(eq(contacts.id, id))
      .returning();
    if (!updated) return null;

    const finalGroupIds = await resolveGroupIds(tx, groupIds, newGroups);
    await saveContactGroups(tx, id, finalGroupIds);
    const contactGroupRows =
      finalGroupIds.length > 0
        ? await tx.select({ id: groups.id, name: groups.name }).from(groups).where(inArray(groups.id, finalGroupIds))
        : [];
    const allGroups = await tx
      .select({ id: groups.id, name: groups.name })
      .from(groups)
      .orderBy(sql`${groups.name} collate "ru-RU-x-icu"`);

    return { updated, contactGroupRows, allGroups };
  });

  if (!result) {
    return { ok: false, message: "Контакт не найден — возможно, его удалили" };
  }

  revalidatePath("/");
  revalidatePath(`/contacts/${id}`);
  revalidatePath("/groups");
  return {
    ok: true,
    values: toFormValues({ ...result.updated, groups: result.contactGroupRows }),
    updatedAtLabel: formatDateTime(result.updated.updatedAt),
    allGroups: result.allGroups,
  };
}

// "Связались": remembers the moment of contact right away, without saving the card.
// Notes, the moment of the last note and "Сохранено · …" in the card stay as they are.
export async function markContacted(id: number): Promise<MarkContactedResult> {
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, message: "Контакт не найден" };
  }

  const marked = await db.transaction(async (tx) => {
    // Locked, so that two presses at once can't both take the same moment as the previous one.
    const [current] = await tx
      .select({ previous: exactMoment(contacts.lastContactedAt) })
      .from(contacts)
      .where(eq(contacts.id, id))
      .for("update");
    if (!current) return null;

    const [updated] = await tx
      .update(contacts)
      .set({ lastContactedAt: sql`now()`, updatedAt: sql`${contacts.updatedAt}` })
      .where(eq(contacts.id, id))
      .returning({ name: contacts.name, markedAt: exactMoment(contacts.lastContactedAt) });
    return { name: updated.name, markedAt: updated.markedAt!, previous: current.previous };
  });

  if (!marked) {
    return { ok: false, message: "Контакт не найден — возможно, его удалили" };
  }

  revalidatePath("/");
  return { ok: true, ...marked };
}

// Puts back the moment of contact from before "Связались". Changes nothing if the contact was
// marked again since (in this or another tab) or deleted.
export async function undoMarkContacted(
  id: number,
  markedAt: string,
  previous: string | null,
): Promise<UndoMarkContactedResult> {
  if (
    !Number.isInteger(id) ||
    id <= 0 ||
    typeof markedAt !== "string" ||
    !MOMENT_PATTERN.test(markedAt) ||
    (previous !== null && (typeof previous !== "string" || !MOMENT_PATTERN.test(previous)))
  ) {
    return { ok: false, message: "Не удалось отменить отметку" };
  }

  const undone = await db
    .update(contacts)
    .set({
      lastContactedAt: previous === null ? null : sql`${previous}::timestamptz`,
      updatedAt: sql`${contacts.updatedAt}`,
    })
    .where(
      and(
        eq(contacts.id, id),
        sql`${contacts.lastContactedAt} = ${markedAt}::timestamptz`,
        previous === null ? undefined : sql`${previous}::timestamptz <= ${markedAt}::timestamptz`,
      ),
    )
    .returning({ id: contacts.id });

  revalidatePath("/");
  return { ok: true, undone: undone.length > 0 };
}

export async function deleteContact(id: number): Promise<DeleteContactResult> {
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, message: "Контакт не найден" };
  }

  const [deleted] = await db
    .delete(contacts)
    .where(eq(contacts.id, id))
    .returning({ name: contacts.name });

  if (!deleted) {
    return { ok: false, message: "Контакт не найден — возможно, его уже удалили" };
  }

  // No revalidatePath here: it would re-render the current page, which is the card of the
  // deleted contact, and flash "not found". The client navigates away and refreshes instead.
  return { ok: true, name: deleted.name };
}
