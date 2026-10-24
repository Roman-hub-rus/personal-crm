"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { contacts } from "@/db/schema";
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
  | { ok: true; values: ContactFormValues; updatedAtLabel: string }
  | Failure;

export type DeleteContactResult = { ok: true; name: string } | Failure;

export async function createContact(input: unknown): Promise<CreateContactResult> {
  const parsed = contactInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: toFieldErrors(parsed.error) };
  }

  const [created] = await db
    .insert(contacts)
    .values(parsed.data)
    .returning({ id: contacts.id, name: contacts.name });

  revalidatePath("/");
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

  const [updated] = await db
    .update(contacts)
    .set(parsed.data)
    .where(eq(contacts.id, id))
    .returning();

  if (!updated) {
    return { ok: false, message: "Контакт не найден — возможно, его удалили" };
  }

  revalidatePath("/");
  revalidatePath(`/contacts/${id}`);
  return {
    ok: true,
    values: toFormValues(updated),
    updatedAtLabel: formatDateTime(updated.updatedAt),
  };
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
