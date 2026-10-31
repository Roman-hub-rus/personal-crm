"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { groups } from "@/db/schema";
import { groupNameSchema } from "@/lib/contact-groups";

type Failure = { ok: false; message: string };

export type CreateGroupResult = { ok: true; id: number; name: string } | Failure;
export type RenameGroupResult = { ok: true; name: string } | Failure;
export type DeleteGroupResult = { ok: true; name: string } | Failure;

const UNIQUE_VIOLATION = "23505";

function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  if ("code" in error && typeof error.code === "string") return error.code;
  if ("cause" in error) return errorCode(error.cause);
  return undefined;
}

function isUniqueViolation(error: unknown): boolean {
  return errorCode(error) === UNIQUE_VIOLATION;
}

// After a unique-index conflict, names the group that already holds that name.
async function conflictMessage(name: string): Promise<string> {
  const [existing] = await db
    .select({ name: groups.name })
    .from(groups)
    .where(sql`lower(${groups.name}) = lower(${name})`);
  return `Группа «${existing?.name ?? name}» уже есть`;
}

export async function createGroup(input: unknown): Promise<CreateGroupResult> {
  const parsed = groupNameSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  try {
    const [created] = await db
      .insert(groups)
      .values({ name: parsed.data })
      .returning({ id: groups.id, name: groups.name });
    revalidatePath("/", "layout");
    return { ok: true, id: created.id, name: created.name };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, message: await conflictMessage(parsed.data) };
    }
    throw error;
  }
}

export async function renameGroup(id: number, input: unknown): Promise<RenameGroupResult> {
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, message: "Группа не найдена" };
  }

  const parsed = groupNameSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  try {
    const [updated] = await db
      .update(groups)
      .set({ name: parsed.data })
      .where(eq(groups.id, id))
      .returning({ name: groups.name });
    if (!updated) {
      return { ok: false, message: "Группа не найдена — возможно, её удалили" };
    }
    revalidatePath("/", "layout");
    return { ok: true, name: updated.name };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, message: await conflictMessage(parsed.data) };
    }
    throw error;
  }
}

export async function deleteGroup(id: number): Promise<DeleteGroupResult> {
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, message: "Группа не найдена" };
  }

  const [deleted] = await db.delete(groups).where(eq(groups.id, id)).returning({ name: groups.name });
  if (!deleted) {
    return { ok: false, message: "Группа не найдена — возможно, её удалили" };
  }

  revalidatePath("/", "layout");
  return { ok: true, name: deleted.name };
}
