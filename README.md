# Tsundoko

![Tsundoko](docs/readme_logo.svg)

Lightweight, AI-first bookmarking app

## Development

Install dependencies with `bun install`, then copy `.env.example` to `.env`. Set the following variables:

- `DATABASE_URL`: PostgreSQL (13 or later) connection string.
- `BETTER_AUTH_SECRET`: a random string of at least 32 characters.
- `BETTER_AUTH_URL`: the API origin, `http://localhost:3300` for local development. Passkeys use this URL's host as the RP ID and this origin plus `trustedOrigins` as allowed origins.
- `ENABLE_SIGNUP`: set to `true` to let people create accounts after the first one exists. Defaults to `false`.

Create the database, then apply migrations with `bun run migrate:apply`. Run `bun run migrate:create` after changing `src/db/schema.ts` to generate a new migration. Run `bun run dev` to start both Vite and Hono.

## Deployment

Run `bun run build` to produce `dist/`, then start the server to serve the built UI and the API together from one process on port 3300. The app needs PostgreSQL and the environment variables above.

On first launch with no accounts, the app asks you to create the first account with an email address, a display name, and a passkey. Later signups are only offered when `ENABLE_SIGNUP=true`.

Keep the `data/` directory across restarts to retain the thumbnail images.
