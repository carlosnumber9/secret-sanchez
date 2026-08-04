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

export const editionKind = pgEnum("edition_kind", ["test", "final"]);
export const editionStatus = pgEnum("edition_status", ["draft", "ready", "drawn", "sent", "archived"]);
export const drawStatus = pgEnum("draw_status", ["draft", "generated", "locked", "sent", "revoked"]);
export const preferredChannel = pgEnum("preferred_channel", ["email", "whatsapp", "both", "manual"]);
export const notificationChannel = pgEnum("notification_channel", ["email", "whatsapp", "manual"]);
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
  (table) => [
    uniqueIndex("admin_users_email_idx").on(sql`lower(${table.email})`),
    uniqueIndex("admin_users_auth_user_id_idx").on(table.authUserId)
  ]
);

export const families = pgTable("families", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 180 }).notNull(),
  slug: varchar("slug", { length: 180 }).notNull().unique(),
  ownerAdminId: uuid("owner_admin_id")
    .notNull()
    .references(() => adminUsers.id),
  themeConfig: jsonb("theme_config"),
  ...timestamps
});

export const familyIslands = pgTable("family_islands", {
  id: uuid("id").primaryKey().defaultRandom(),
  familyId: uuid("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 180 }).notNull(),
  color: varchar("color", { length: 32 }),
  description: text("description"),
  ...timestamps
});

export const participants = pgTable("participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  familyId: uuid("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  familyIslandId: uuid("family_island_id")
    .notNull()
    .references(() => familyIslands.id),
  name: varchar("name", { length: 180 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 48 }),
  avatarUrl: text("avatar_url"),
  preferredChannel: preferredChannel("preferred_channel").default("email").notNull(),
  ...timestamps
});

export const drawEditions = pgTable(
  "draw_editions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 180 }).notNull(),
    year: integer("year").notNull(),
    kind: editionKind("kind").notNull(),
    status: editionStatus("status").default("draft").notNull(),
    createdByAdminId: uuid("created_by_admin_id").references(() => adminUsers.id),
    ...timestamps
  },
  (table) => [
    uniqueIndex("draw_editions_one_final_per_year_idx")
      .on(table.familyId, table.year)
      .where(sql`${table.kind} = 'final' and ${table.status} <> 'archived'`)
  ]
);

export const editionParticipants = pgTable(
  "edition_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => drawEditions.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").default(true).notNull(),
    canGive: boolean("can_give").default(true).notNull(),
    canReceive: boolean("can_receive").default(true).notNull(),
    ...timestamps
  },
  (table) => [uniqueIndex("edition_participants_edition_participant_idx").on(table.editionId, table.participantId)]
);

export const editionIslandConfigs = pgTable(
  "edition_island_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => drawEditions.id, { onDelete: "cascade" }),
    familyIslandId: uuid("family_island_id")
      .notNull()
      .references(() => familyIslands.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").default(true).notNull(),
    ...timestamps
  },
  (table) => [uniqueIndex("edition_island_configs_edition_island_idx").on(table.editionId, table.familyIslandId)]
);

export const drawRules = pgTable("draw_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  editionId: uuid("edition_id")
    .notNull()
    .references(() => drawEditions.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 80 }).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  config: jsonb("config").default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const exclusionRules = pgTable("exclusion_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  editionId: uuid("edition_id")
    .notNull()
    .references(() => drawEditions.id, { onDelete: "cascade" }),
  fromParticipantId: uuid("from_participant_id")
    .notNull()
    .references(() => participants.id, { onDelete: "cascade" }),
  toParticipantId: uuid("to_participant_id")
    .notNull()
    .references(() => participants.id, { onDelete: "cascade" }),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const draws = pgTable(
  "draws",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => drawEditions.id, { onDelete: "cascade" }),
    attemptNumber: integer("attempt_number").notNull(),
    status: drawStatus("status").default("draft").notNull(),
    seed: varchar("seed", { length: 120 }),
    generatedByAdminId: uuid("generated_by_admin_id").references(() => adminUsers.id),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedByAdminId: uuid("revoked_by_admin_id").references(() => adminUsers.id),
    revokeReason: text("revoke_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("draws_edition_attempt_idx").on(table.editionId, table.attemptNumber),
    uniqueIndex("draws_one_current_per_edition_idx")
      .on(table.editionId)
      .where(sql`${table.status} <> 'revoked'`)
  ]
);

export const drawParticipants = pgTable(
  "draw_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    drawId: uuid("draw_id")
      .notNull()
      .references(() => draws.id, { onDelete: "cascade" }),
    sourceParticipantId: uuid("source_participant_id").references(() => participants.id, { onDelete: "set null" }),
    sourceFamilyIslandId: uuid("source_family_island_id").references(() => familyIslands.id, { onDelete: "set null" }),
    name: varchar("name", { length: 180 }).notNull(),
    email: varchar("email", { length: 320 }),
    phone: varchar("phone", { length: 48 }),
    preferredChannel: preferredChannel("preferred_channel").notNull(),
    familyIslandName: varchar("family_island_name", { length: 180 }).notNull(),
    canGive: boolean("can_give").notNull(),
    canReceive: boolean("can_receive").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [uniqueIndex("draw_participants_draw_source_idx").on(table.drawId, table.sourceParticipantId)]
);

export const assignments = pgTable(
  "assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    drawId: uuid("draw_id")
      .notNull()
      .references(() => draws.id, { onDelete: "cascade" }),
    giverId: uuid("giver_id")
      .notNull()
      .references(() => drawParticipants.id, { onDelete: "cascade" }),
    receiverId: uuid("receiver_id")
      .notNull()
      .references(() => drawParticipants.id, { onDelete: "cascade" }),
    revealTokenHash: varchar("reveal_token_hash", { length: 64 }).notNull().unique(),
    revealTokenCiphertext: text("reveal_token_ciphertext"),
    tokenCreatedAt: timestamp("token_created_at", { withTimezone: true }).defaultNow().notNull(),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("assignments_draw_giver_idx").on(table.drawId, table.giverId),
    uniqueIndex("assignments_draw_receiver_idx").on(table.drawId, table.receiverId)
  ]
);

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
  idempotencyKey: varchar("idempotency_key", { length: 128 }).unique(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const familiesRelations = relations(families, ({ one, many }) => ({
  owner: one(adminUsers, { fields: [families.ownerAdminId], references: [adminUsers.id] }),
  islands: many(familyIslands),
  participants: many(participants),
  editions: many(drawEditions)
}));

export const drawEditionsRelations = relations(drawEditions, ({ one, many }) => ({
  family: one(families, { fields: [drawEditions.familyId], references: [families.id] }),
  participants: many(editionParticipants),
  islandConfigs: many(editionIslandConfigs),
  draws: many(draws)
}));

export const drawsRelations = relations(draws, ({ one, many }) => ({
  edition: one(drawEditions, { fields: [draws.editionId], references: [drawEditions.id] }),
  participants: many(drawParticipants),
  assignments: many(assignments)
}));

export const assignmentsRelations = relations(assignments, ({ one, many }) => ({
  draw: one(draws, { fields: [assignments.drawId], references: [draws.id] }),
  giver: one(drawParticipants, { fields: [assignments.giverId], references: [drawParticipants.id], relationName: "giver" }),
  receiver: one(drawParticipants, { fields: [assignments.receiverId], references: [drawParticipants.id], relationName: "receiver" }),
  notifications: many(notificationLogs)
}));
