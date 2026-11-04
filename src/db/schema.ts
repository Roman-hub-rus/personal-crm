import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  pgEnum,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// Tables of sign-in. Better Auth owns users, sessions, accounts and verifications: names and fields follow
// its base schema (fields in camelCase, columns in snake_case), and ids are text that the library generates.
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  // Not asked at sign-in, so it stays empty.
  name: text("name").notNull(),
  // Always lower case: Anna@Example.COM and anna@example.com are one user.
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// One row per device the user is signed in on.
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

// Required by Better Auth; with sign-in by email link it only holds the link to the user.
export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("accounts_user_id_idx").on(table.userId)],
);

// Sign-in links waiting to be opened (the token is stored hashed).
export const verifications = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("verifications_identifier_idx").on(table.identifier)],
);

// Every sign-in email that was requested, to allow at most 3 per address in 10 minutes.
// Written before sending, so a failing mail service does not let the limit be bypassed.
export const signInEmails = pgTable(
  "sign_in_emails",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    email: text("email").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("sign_in_emails_email_sent_at_idx").on(table.email, table.sentAt)],
);

// How often the owner wants to be in touch with a contact. Months, quarters and years are
// calendar months, so the period can't be stored as a number of days.
export const contactFrequency = pgEnum("contact_frequency", ["week", "month", "quarter", "year"]);

export const contacts = pgTable(
  "contacts",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    // Whose contact this is. No cascade: deleting a user by mistake must not take the contacts with it.
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id),
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
  },
  (table) => [index("contacts_owner_id_idx").on(table.ownerId)],
);

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type ContactFrequency = (typeof contactFrequency.enumValues)[number];

// A circle the owner made up (family, friends, tennis…); a contact can be in any number of them.
export const groups = pgTable(
  "groups",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    // Whose group this is. No cascade, like contacts.owner_id.
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("groups_owner_id_idx").on(table.ownerId),
    // Case-insensitive within one user: "теннис" and "Теннис" are the same group, even under concurrent
    // inserts. Different users may have groups with the same name.
    uniqueIndex("groups_owner_lower_name_idx").on(table.ownerId, sql`lower(${table.name})`),
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
