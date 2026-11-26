ALTER TABLE "user" ADD COLUMN "sort_by_active" text DEFAULT 'newest' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "sort_by_archived" text DEFAULT 'newest' NOT NULL;