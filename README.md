# Tsundoko

![Tsundoko](docs/readme_logo.svg)

Lightweight, AI-first bookmarking app

## Development

Install dependencies with `bun install`, then copy `.env.example` to `.env`. Set the following variables:

- `DATABASE_URL`: PostgreSQL (13 or later) connection string. The database must provide the `pgvector` extension, such as the `pgvector/pgvector:pg19` image or a provider that ships it, and the connecting role needs permission to create extensions.
- `BETTER_AUTH_SECRET`: a random string of at least 32 characters.
- `BETTER_AUTH_URL`: the API origin, `http://localhost:3300` for local development. Passkeys use this URL's host as the RP ID and this origin plus `trustedOrigins` as allowed origins.
- `ENABLE_SIGNUP`: set to `true` to let people create accounts after the first one exists. Defaults to `false`.

Create the database, then apply migrations with `bun run migrate:apply`. Run `bun run migrate:create` after changing `src/db/schema.ts` to generate a new migration. Run `bun run dev` to start both Vite and Hono.

Semantic search is optional and stays off until `EMBEDDING_API_KEY` is set. Enabling it sends bookmark titles, descriptions, article excerpts, and search queries to the configured endpoint:

- `EMBEDDING_API_KEY`: API key for an OpenAI-compatible `/embeddings` endpoint.
- `EMBEDDING_BASE_URL`: base URL of that endpoint. Defaults to `https://api.openai.com/v1`.
- `EMBEDDING_MODEL`: model name. Defaults to `text-embedding-3-small`. The model must return 1536 values.

Run `bun run embeddings:backfill` to embed bookmarks saved while the feature was off or the provider was unreachable. After changing `EMBEDDING_MODEL`, run `bun run embeddings:backfill --force` to re-embed every bookmark.

## Deployment

Run `bun run migrate:apply` to apply the latest migrations, and run `bun run build` to produce `dist/`. Then `bun run start` starts the server to serve the built UI and the API together from one process on port 3300. The app needs PostgreSQL and the environment variables above.

On first launch with no accounts, the app asks you to create the first account with an email address, a display name, and a passkey. Later signups are only offered when `ENABLE_SIGNUP=true`.

Keep the `data/` directory across restarts to retain the thumbnail images. Health checks are available at `/api/health`.
