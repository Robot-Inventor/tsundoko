CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD COLUMN "embedding" vector(1536);--> statement-breakpoint
CREATE INDEX "bookmarks_embedding_idx" ON "bookmarks" USING hnsw ("embedding" vector_cosine_ops);
