ALTER TYPE "public"."notification_channel" ADD VALUE 'manual';--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "reveal_token_ciphertext" text;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD COLUMN "idempotency_key" varchar(128);--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_idempotency_key_unique" UNIQUE("idempotency_key");