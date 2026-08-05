DROP INDEX "public"."draw_editions_one_final_per_year_idx";--> statement-breakpoint
ALTER TABLE "draw_editions" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "draw_editions" ALTER COLUMN "status" SET DATA TYPE text USING "status"::text;--> statement-breakpoint
UPDATE "draw_editions" SET "status" = 'ready' WHERE "status" = 'draft';--> statement-breakpoint
DROP TYPE "public"."edition_status";--> statement-breakpoint
CREATE TYPE "public"."edition_status" AS ENUM('ready', 'drawn', 'sent', 'archived');--> statement-breakpoint
ALTER TABLE "draw_editions" ALTER COLUMN "status" SET DATA TYPE "public"."edition_status" USING "status"::"public"."edition_status";--> statement-breakpoint
ALTER TABLE "draw_editions" ALTER COLUMN "status" SET DEFAULT 'ready'::"public"."edition_status";--> statement-breakpoint
CREATE UNIQUE INDEX "draw_editions_one_final_per_year_idx" ON "draw_editions" USING btree ("family_id", "year") WHERE "kind" = 'final' AND "status" <> 'archived';
