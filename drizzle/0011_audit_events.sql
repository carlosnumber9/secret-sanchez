CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event" varchar(80) NOT NULL,
	"actor_admin_id" uuid NOT NULL,
	"edition_id" uuid NOT NULL,
	"draw_id" uuid NOT NULL,
	"assignment_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "audit_events_draw_event_idx" ON "audit_events" USING btree ("draw_id","event","created_at");
--> statement-breakpoint
REVOKE ALL ON TABLE public.audit_events FROM PUBLIC, anon, authenticated;
