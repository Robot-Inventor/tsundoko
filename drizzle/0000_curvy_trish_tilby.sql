CREATE TABLE "bookmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"siteName" text NOT NULL,
	"thumbnailUrl" text,
	"faviconUrl" text,
	"addedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookmarks_url_unique" UNIQUE("url")
);
