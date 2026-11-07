CREATE INDEX "draw_editions_family_history_idx" ON "draw_editions" USING btree ("family_id","year" DESC NULLS FIRST,"created_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "draw_participants_source_idx" ON "draw_participants" USING btree ("source_participant_id","draw_id");--> statement-breakpoint
CREATE INDEX "draw_rules_edition_idx" ON "draw_rules" USING btree ("edition_id");--> statement-breakpoint
CREATE INDEX "edition_participants_person_idx" ON "edition_participants" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX "exclusion_rules_edition_idx" ON "exclusion_rules" USING btree ("edition_id");--> statement-breakpoint
CREATE INDEX "families_owner_created_idx" ON "families" USING btree ("owner_admin_id","created_at");--> statement-breakpoint
CREATE INDEX "family_islands_family_created_idx" ON "family_islands" USING btree ("family_id","created_at");--> statement-breakpoint
CREATE INDEX "notification_logs_assignment_history_idx" ON "notification_logs" USING btree ("assignment_id","channel","created_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "participants_family_layout_idx" ON "participants" USING btree ("family_id","family_island_id","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "participants_island_order_idx" ON "participants" USING btree ("family_island_id","sort_order");