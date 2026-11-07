ALTER TABLE "admin_users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "draw_editions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "draw_islands" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "draw_participants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "draw_rules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "draws" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "edition_island_configs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "edition_participants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "exclusion_rules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "families" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "family_islands" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notification_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "participants" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE public.admin_users, public.families, public.family_islands, public.participants, public.draw_editions, public.edition_participants, public.edition_island_configs, public.draw_rules, public.exclusion_rules, public.draws, public.draw_participants, public.draw_islands, public.assignments, public.notification_logs FROM PUBLIC, anon, authenticated;
