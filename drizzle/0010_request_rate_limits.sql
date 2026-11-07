CREATE TABLE "request_rate_limits" (
	"key_hash" varchar(64) PRIMARY KEY NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "request_rate_limits_attempts_check" CHECK ("request_rate_limits"."attempts" > 0)
);
--> statement-breakpoint
ALTER TABLE "request_rate_limits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "request_rate_limits_expiry_idx" ON "request_rate_limits" USING btree ("expires_at");
--> statement-breakpoint
REVOKE ALL ON TABLE public.request_rate_limits FROM PUBLIC, anon, authenticated;
