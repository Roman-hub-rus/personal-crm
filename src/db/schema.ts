import { sql } from "drizzle-orm";
import { integer, pgTable, primaryKey, pgEnum, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";

// How often the owner wants to be in touch with a contact. Months, quarters and years are
// calendar months, so the period can't be stored as a number of days.
export const contactFrequency = pgEnum("contact_frequency", ["week", "month", "quarter", "year"]);

export const contacts = pgTable("contacts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  // Who this person is: occupation, relation, anything that helps to recall them.
  about: text("about"),
  howWeMet: text("how_we_met"),
  phone: text("phone"),
  email: text("email"),
  // Free-form log of conversations and agreements; new notes are appended to the end.
  notes: text("notes"),
  // NULL means "not set": the contact never shows up in "Пора связаться".
  contactFrequency: contactFrequency("contact_frequency"),
  // Last save that changed the text of the notes; NULL if unknown.
  lastNoteAt: timestamp("last_note_at", { withTimezone: true }),
  // Last press of "Связались"; NULL if never pressed.
  lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
  // When the frequency changed from "not set" to a value; NULL while it is not set.
  frequencySetAt: timestamp("frequency_set_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type ContactFrequency = (typeof contactFrequency.enumValues)[number];

// A circle the owner made up (family, friends, tennis…); a contact can be in any number of them.
export const groups = pgTable(
  "groups",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Case-insensitive: "теннис" and "Теннис" are the same group, even under concurrent inserts.
    uniqueIndex("groups_lower_name_idx").on(sql`lower(${table.name})`),
  ],
);

export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;

// Membership: which contacts are in which groups. Deleting either side removes the membership.
export const contactGroups = pgTable(
  "contact_groups",
  {
    contactId: integer("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    groupId: integer("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.contactId, table.groupId] }),
    index("contact_groups_group_id_idx").on(table.groupId),
  ],
);
