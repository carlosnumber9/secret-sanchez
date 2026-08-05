ALTER TABLE "participants" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
WITH "ranked_participants" AS (
	SELECT
		"id",
		row_number() OVER (
			PARTITION BY "family_island_id"
			ORDER BY "created_at", "id"
		) - 1 AS "position"
	FROM "participants"
)
UPDATE "participants"
SET "sort_order" = "ranked_participants"."position"
FROM "ranked_participants"
WHERE "participants"."id" = "ranked_participants"."id";
