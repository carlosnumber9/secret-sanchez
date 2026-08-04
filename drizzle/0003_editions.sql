-- This migration preserves the current production draw as the first definitive
-- edition of its family. Review and back up Supabase before applying it.

ALTER TYPE "draw_status" RENAME TO "draw_status_old";
CREATE TYPE "draw_status" AS ENUM ('draft', 'generated', 'locked', 'sent', 'revoked');
ALTER TABLE "draws" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "draws" ALTER COLUMN "status" TYPE "draw_status" USING "status"::text::"draw_status";
ALTER TABLE "draws" ALTER COLUMN "status" SET DEFAULT 'draft';
DROP TYPE "draw_status_old";
CREATE TYPE "edition_kind" AS ENUM ('test', 'final');
CREATE TYPE "edition_status" AS ENUM ('draft', 'ready', 'drawn', 'sent', 'archived');

ALTER TABLE "family_groups" RENAME TO "families";
ALTER TABLE "families" RENAME CONSTRAINT "family_groups_pkey" TO "families_pkey";
ALTER TABLE "families" RENAME CONSTRAINT "family_groups_slug_unique" TO "families_slug_unique";
ALTER TABLE "families" RENAME CONSTRAINT "family_groups_owner_admin_id_admin_users_id_fk" TO "families_owner_admin_id_admin_users_id_fk";
ALTER TABLE "family_islands" RENAME COLUMN "group_id" TO "family_id";
ALTER TABLE "participants" RENAME COLUMN "group_id" TO "family_id";

CREATE TABLE "draw_editions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "family_id" uuid NOT NULL,
  "name" varchar(180) NOT NULL,
  "year" integer NOT NULL,
  "kind" "edition_kind" NOT NULL,
  "status" "edition_status" DEFAULT 'draft' NOT NULL,
  "created_by_admin_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

INSERT INTO "draw_editions" ("id", "family_id", "name", "year", "kind", "status", "created_by_admin_id", "created_at", "updated_at")
SELECT
  f.id,
  f.id,
  f.name,
  f.year,
  'final'::"edition_kind",
  f.status::text::"edition_status",
  COALESCE((SELECT d.generated_by_admin_id FROM draws d WHERE d.group_id = f.id ORDER BY d.created_at DESC LIMIT 1), f.owner_admin_id),
  f.created_at,
  f.updated_at
FROM "families" f;

ALTER TABLE "draw_editions" ADD CONSTRAINT "draw_editions_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE cascade;
ALTER TABLE "draw_editions" ADD CONSTRAINT "draw_editions_created_by_admin_id_admin_users_id_fk" FOREIGN KEY ("created_by_admin_id") REFERENCES "admin_users"("id");
CREATE UNIQUE INDEX "draw_editions_one_final_per_year_idx" ON "draw_editions" ("family_id", "year") WHERE "kind" = 'final' AND "status" <> 'archived';

CREATE TABLE "edition_participants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "edition_id" uuid NOT NULL REFERENCES "draw_editions"("id") ON DELETE cascade,
  "participant_id" uuid NOT NULL REFERENCES "participants"("id") ON DELETE cascade,
  "enabled" boolean DEFAULT true NOT NULL,
  "can_give" boolean DEFAULT true NOT NULL,
  "can_receive" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "edition_participants_edition_participant_idx" ON "edition_participants" ("edition_id", "participant_id");
INSERT INTO "edition_participants" ("edition_id", "participant_id", "enabled", "can_give", "can_receive", "created_at", "updated_at")
SELECT p.family_id, p.id, p.active, p.can_give, p.can_receive, p.created_at, p.updated_at FROM "participants" p;

CREATE TABLE "edition_island_configs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "edition_id" uuid NOT NULL REFERENCES "draw_editions"("id") ON DELETE cascade,
  "family_island_id" uuid NOT NULL REFERENCES "family_islands"("id") ON DELETE cascade,
  "enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "edition_island_configs_edition_island_idx" ON "edition_island_configs" ("edition_id", "family_island_id");
INSERT INTO "edition_island_configs" ("edition_id", "family_island_id") SELECT fi.family_id, fi.id FROM "family_islands" fi;

ALTER TABLE "draw_rules" DROP CONSTRAINT "draw_rules_group_id_family_groups_id_fk";
ALTER TABLE "draw_rules" RENAME COLUMN "group_id" TO "edition_id";
ALTER TABLE "draw_rules" ADD CONSTRAINT "draw_rules_edition_id_draw_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "draw_editions"("id") ON DELETE cascade;

ALTER TABLE "exclusion_rules" DROP CONSTRAINT "exclusion_rules_group_id_family_groups_id_fk";
ALTER TABLE "exclusion_rules" RENAME COLUMN "group_id" TO "edition_id";
ALTER TABLE "exclusion_rules" ADD CONSTRAINT "exclusion_rules_edition_id_draw_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "draw_editions"("id") ON DELETE cascade;

ALTER TABLE "draws" DROP CONSTRAINT "draws_group_id_family_groups_id_fk";
ALTER TABLE "draws" ADD COLUMN "edition_id" uuid;
ALTER TABLE "draws" ADD COLUMN "attempt_number" integer;
ALTER TABLE "draws" ADD COLUMN "revoked_at" timestamp with time zone;
ALTER TABLE "draws" ADD COLUMN "revoked_by_admin_id" uuid;
ALTER TABLE "draws" ADD COLUMN "revoke_reason" text;
UPDATE "draws" d SET "edition_id" = d."group_id";
WITH numbered AS (
  SELECT id, row_number() OVER (PARTITION BY group_id ORDER BY created_at, id)::integer AS attempt_number FROM draws
)
UPDATE draws d SET attempt_number = numbered.attempt_number FROM numbered WHERE numbered.id = d.id;
ALTER TABLE "draws" ALTER COLUMN "edition_id" SET NOT NULL;
ALTER TABLE "draws" ALTER COLUMN "attempt_number" SET NOT NULL;
ALTER TABLE "draws" DROP COLUMN "group_id";
ALTER TABLE "draws" DROP COLUMN "year";
ALTER TABLE "draws" ADD CONSTRAINT "draws_edition_id_draw_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "draw_editions"("id") ON DELETE cascade;
ALTER TABLE "draws" ADD CONSTRAINT "draws_revoked_by_admin_id_admin_users_id_fk" FOREIGN KEY ("revoked_by_admin_id") REFERENCES "admin_users"("id");
CREATE UNIQUE INDEX "draws_edition_attempt_idx" ON "draws" ("edition_id", "attempt_number");
CREATE UNIQUE INDEX "draws_one_current_per_edition_idx" ON "draws" ("edition_id") WHERE "status" <> 'revoked';

CREATE TABLE "draw_participants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "draw_id" uuid NOT NULL REFERENCES "draws"("id") ON DELETE cascade,
  "source_participant_id" uuid REFERENCES "participants"("id") ON DELETE set null,
  "source_family_island_id" uuid REFERENCES "family_islands"("id") ON DELETE set null,
  "name" varchar(180) NOT NULL,
  "email" varchar(320),
  "phone" varchar(48),
  "preferred_channel" "preferred_channel" NOT NULL,
  "family_island_name" varchar(180) NOT NULL,
  "can_give" boolean NOT NULL,
  "can_receive" boolean NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "draw_participants_draw_source_idx" ON "draw_participants" ("draw_id", "source_participant_id");
INSERT INTO "draw_participants" ("draw_id", "source_participant_id", "source_family_island_id", "name", "email", "phone", "preferred_channel", "family_island_name", "can_give", "can_receive", "created_at")
SELECT DISTINCT d.id, p.id, fi.id, p.name, p.email, p.phone, p.preferred_channel, fi.name, p.can_give, p.can_receive, d.created_at
FROM draws d
JOIN assignments a ON a.draw_id = d.id
JOIN participants p ON p.id = a.giver_id OR p.id = a.receiver_id
JOIN family_islands fi ON fi.id = p.family_island_id;

ALTER TABLE "assignments" DROP CONSTRAINT "assignments_giver_id_participants_id_fk";
ALTER TABLE "assignments" DROP CONSTRAINT "assignments_receiver_id_participants_id_fk";
ALTER TABLE "assignments" ADD COLUMN "giver_snapshot_id" uuid;
ALTER TABLE "assignments" ADD COLUMN "receiver_snapshot_id" uuid;
UPDATE assignments a SET giver_snapshot_id = dp.id FROM draw_participants dp WHERE dp.draw_id = a.draw_id AND dp.source_participant_id = a.giver_id;
UPDATE assignments a SET receiver_snapshot_id = dp.id FROM draw_participants dp WHERE dp.draw_id = a.draw_id AND dp.source_participant_id = a.receiver_id;
ALTER TABLE "assignments" ALTER COLUMN "giver_snapshot_id" SET NOT NULL;
ALTER TABLE "assignments" ALTER COLUMN "receiver_snapshot_id" SET NOT NULL;
ALTER TABLE "assignments" DROP COLUMN "giver_id";
ALTER TABLE "assignments" DROP COLUMN "receiver_id";
ALTER TABLE "assignments" RENAME COLUMN "giver_snapshot_id" TO "giver_id";
ALTER TABLE "assignments" RENAME COLUMN "receiver_snapshot_id" TO "receiver_id";
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_giver_id_draw_participants_id_fk" FOREIGN KEY ("giver_id") REFERENCES "draw_participants"("id") ON DELETE cascade;
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_receiver_id_draw_participants_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "draw_participants"("id") ON DELETE cascade;
CREATE UNIQUE INDEX "assignments_draw_giver_idx" ON "assignments" ("draw_id", "giver_id");
CREATE UNIQUE INDEX "assignments_draw_receiver_idx" ON "assignments" ("draw_id", "receiver_id");

ALTER TABLE "family_islands" DROP CONSTRAINT "family_islands_group_id_family_groups_id_fk";
ALTER TABLE "family_islands" ADD CONSTRAINT "family_islands_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE cascade;
ALTER TABLE "participants" DROP CONSTRAINT "participants_group_id_family_groups_id_fk";
ALTER TABLE "participants" ADD CONSTRAINT "participants_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE cascade;
ALTER TABLE "participants" DROP COLUMN "active";
ALTER TABLE "participants" DROP COLUMN "can_give";
ALTER TABLE "participants" DROP COLUMN "can_receive";
ALTER TABLE "families" DROP COLUMN "year";
ALTER TABLE "families" DROP COLUMN "status";
