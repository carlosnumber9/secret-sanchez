ALTER TYPE "public"."notification_status" ADD VALUE 'read' BEFORE 'manual';--> statement-breakpoint
CREATE TABLE "draw_islands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draw_id" uuid NOT NULL,
	"source_family_island_id" uuid,
	"name" varchar(180) NOT NULL,
	"representative_source_participant_id" uuid,
	"representative_name" varchar(180) NOT NULL,
	"representative_email" varchar(320),
	"representative_phone" varchar(48),
	"preferred_channel" "preferred_channel" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "assignments_draw_giver_idx";--> statement-breakpoint
ALTER TABLE "assignments" ALTER COLUMN "giver_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "draw_participants" ALTER COLUMN "preferred_channel" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "participants" ALTER COLUMN "preferred_channel" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "giver_island_id" uuid;--> statement-breakpoint
ALTER TABLE "draw_participants" ADD COLUMN "is_baby" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "edition_island_configs" ADD COLUMN "representative_participant_id" uuid;--> statement-breakpoint
ALTER TABLE "edition_participants" ADD COLUMN "is_baby" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "edition_participants" ADD COLUMN "preferred_channel" "preferred_channel";--> statement-breakpoint
ALTER TABLE "participants" ADD COLUMN "is_baby" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "participants" SET "preferred_channel" = NULL WHERE "preferred_channel" = 'manual';--> statement-breakpoint
UPDATE "edition_participants" ep
SET "is_baby" = p."is_baby",
    "can_give" = CASE WHEN p."is_baby" THEN false ELSE ep."can_give" END,
    "can_receive" = CASE WHEN p."is_baby" THEN true ELSE ep."can_receive" END,
    "preferred_channel" = CASE WHEN p."is_baby" THEN NULL ELSE p."preferred_channel" END
FROM "participants" p
WHERE p."id" = ep."participant_id";--> statement-breakpoint
ALTER TABLE "draw_islands" ADD CONSTRAINT "draw_islands_draw_id_draws_id_fk" FOREIGN KEY ("draw_id") REFERENCES "public"."draws"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draw_islands" ADD CONSTRAINT "draw_islands_source_family_island_id_family_islands_id_fk" FOREIGN KEY ("source_family_island_id") REFERENCES "public"."family_islands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draw_islands" ADD CONSTRAINT "draw_islands_representative_source_participant_id_participants_id_fk" FOREIGN KEY ("representative_source_participant_id") REFERENCES "public"."participants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "draw_islands_draw_source_idx" ON "draw_islands" USING btree ("draw_id","source_family_island_id");--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_giver_island_id_draw_islands_id_fk" FOREIGN KEY ("giver_island_id") REFERENCES "public"."draw_islands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edition_island_configs" ADD CONSTRAINT "edition_island_configs_representative_participant_id_participants_id_fk" FOREIGN KEY ("representative_participant_id") REFERENCES "public"."participants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assignments_draw_giver_island_idx" ON "assignments" USING btree ("draw_id","giver_island_id") WHERE "assignments"."giver_island_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_logs_provider_message_idx" ON "notification_logs" USING btree ("provider_message_id") WHERE "notification_logs"."provider_message_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "assignments_draw_giver_idx" ON "assignments" USING btree ("draw_id","giver_id") WHERE "assignments"."giver_id" is not null;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_exactly_one_giver_check" CHECK (num_nonnulls("assignments"."giver_id", "assignments"."giver_island_id") = 1);--> statement-breakpoint
ALTER TABLE "edition_participants" ADD CONSTRAINT "edition_participants_baby_roles_check" CHECK (not "edition_participants"."is_baby" or (not "edition_participants"."can_give" and "edition_participants"."can_receive" and "edition_participants"."preferred_channel" is null));--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_baby_without_contact_check" CHECK (not "participants"."is_baby" or ("participants"."email" is null and "participants"."phone" is null and "participants"."preferred_channel" is null));
