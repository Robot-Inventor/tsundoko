CREATE TYPE "public"."thumbnail_fit" AS ENUM('top', 'center');--> statement-breakpoint
ALTER TABLE "bookmarks" ADD COLUMN "thumbnailFit" "thumbnail_fit" DEFAULT 'center' NOT NULL;--> statement-breakpoint
UPDATE "bookmarks" SET "thumbnailFit" = 'top' WHERE "thumbnailFile" IS NOT NULL;
