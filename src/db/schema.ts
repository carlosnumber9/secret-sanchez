import { relations, sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

export const groupStatus = pgEnum("group_status", ["draft", "ready", "drawn", "sent", "archived"]);
export const drawStatus = pgEnum("draw_status", ["draft", "generated", "locked", "sent"]);
export const preferredChannel = pgEnum("preferred_channel", ["email", "whatsapp", "both", "manual"]);
export const notificationChannel = pgEnum("notification_channel", ["email", "whatsapp"]);
export const notificationStatus = pgEnum("notification_status", [
  "pending",
  "sent",
  "delivered",
  "failed",
  "opened",
  "manual"
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
};

export const adminUsers = pgTable(
  "admin_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authUserId: uuid("auth_user_id"),
    email: varchar("email", { length: 320 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    emailIdx: uniqueIndex("admin_users_email_idx").on(sql`lower(${table.email})`)
  })
);

export const familyGroups = pgTable("family_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 180 }).notNull(),
  slug: varchar("slug", { length: 180 }).notNull().unique(),
  year: integer("year").notNull(),
  ownerAdminId: uuid("owner_admin_id")
    .notNull()
    .references(() => adminUsers.id),
  status: groupStatus("status").default("draft").notNull(),
  themeConfig: jsonb("theme_config"),
  ...timestamps
});

export const familyIslands = pgTable("family_islands", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => familyGroups.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 180 }).notNull(),
  color: varchar("color", { length: 32 }),
  description: text("description"),
  ...timestamps
});

export const participants = pgTable("participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => familyGroups.id, { onDelete: "cascade" }),
  familyIslandId: uuid("family_island_id")
    .notNull()
    .references(() => familyIslands.id),
  name: varchar("name", { length: 180 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 48 }),
  avatarUrl: text("avatar_url"),
  active: boolean("active").default(true).notNull(),
  canGive: boolean("can_give").default(true).notNull(),
  canReceive: boolean("can_receive").default(true).notNull(),
  preferredChannel: preferredChannel("preferred_channel").default("email").notNull(),
  ...timestamps
});

export const drawRules = pgTable("draw_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => familyGroups.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 80 }).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  config: jsonb("config").default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const exclusionRules = pgTable("exclusion_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => familyGroups.id, { onDelete: "cascade" }),
  fromParticipantId: uuid("from_participant_id")
    .notNull()
    .references(() => participants.id, { onDelete: "cascade" }),
  toParticipantId: uuid("to_participant_id")
    .notNull()
    .references(() => participants.id, { onDelete: "cascade" }),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const draws = pgTable("draws", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => familyGroups.id, { onDelete: "cascade" }),
  year: integer("year").notNull(),
  status: drawStatus("status").default("draft").notNull(),
  seed: varchar("seed", { length: 120 }),
  generatedByAdminId: uuid("generated_by_admin_id").references(() => adminUsers.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const assignments = pgTable("assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  drawId: uuid("draw_id")
    .notNull()
    .references(() => draws.id, { onDelete: "cascade" }),
  giverId: uuid("giver_id")
    .notNull()
    .references(() => participants.id, { onDelete: "cascade" }),
  receiverId: uuid("receiver_id")
    .notNull()
    .references(() => participants.id, { onDelete: "cascade" }),
  revealTokenHash: varchar("reveal_token_hash", { length: 64 }).notNull().unique(),
  tokenCreatedAt: timestamp("token_created_at", { withTimezone: true }).defaultNow().notNull(),
  openedAt: timestamp("opened_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const notificationLogs = pgTable("notification_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  assignmentId: uuid("assignment_id")
    .notNull()
    .references(() => assignments.id, { onDelete: "cascade" }),
  channel: notificationChannel("channel").notNull(),
  recipient: varchar("recipient", { length: 320 }).notNull(),
  status: notificationStatus("status").default("pending").notNull(),
  providerMessageId: text("provider_message_id"),
  error: text("error"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const familyGroupsRelations = relations(familyGroups, ({ one, many }) => ({
  owner: one(adminUsers, {
    fields: [familyGroups.ownerAdminId],
    references: [adminUsers.id]
  }),
  islands: many(familyIslands),
  participants: many(participants),
  draws: many(draws)
}));

export const familyIslandsRelations = relations(familyIslands, ({ one, many }) => ({
  group: one(familyGroups, {
    fields: [familyIslands.groupId],
    references: [familyGroups.id]
  }),
  participants: many(participants)
}));

export const participantsRelations = relations(participants, ({ one }) => ({
  group: one(familyGroups, {
    fields: [participants.groupId],
    references: [familyGroups.id]
  }),
  island: one(familyIslands, {
    fields: [participants.familyIslandId],
    references: [familyIslands.id]
  })
}));

export const drawsRelations = relations(draws, ({ one, many }) => ({
  group: one(familyGroups, {
    fields: [draws.groupId],
    references: [familyGroups.id]
  }),
  assignments: many(assignments)
}));

export const assignmentsRelations = relations(assignments, ({ one, many }) => ({
  draw: one(draws, {
    fields: [assignments.drawId],
    references: [draws.id]
  }),
  giver: one(participants, {
    fields: [assignments.giverId],
    references: [participants.id],
    relationName: "giver"
  }),
  receiver: one(participants, {
    fields: [assignments.receiverId],
    references: [participants.id],
    relationName: "receiver"
  }),
  notifications: many(notificationLogs)
}));
