# Tsundoko

![Tsundoko](docs/readme_logo.svg)

Lightweight, AI-first bookmarking app

## Development

Install dependencies with `bun install`, then copy `.env.example` to `.env`. Set the following variables:

- `DATABASE_URL`: PostgreSQL (13 or later) connection string.
- `BETTER_AUTH_SECRET`: a random string of at least 32 characters.
- `BETTER_AUTH_URL`: the API origin, `http://localhost:3300` for local development. Passkeys use this URL's host as the RP ID and this origin plus `trustedOrigins` as allowed origins.
- `ENABLE_SIGNUP`: set to `true` to let people create accounts after the first one exists. Defaults to `false`.

Create the database, then apply migrations with `bun run migrate:apply`. Run `bun run migrate:create` after changing `src/db/schema.ts` to generate a new migration.

Run `bun run dev` to start both Vite and Hono. Open the `localhost` URL printed by Vite (passkeys do not treat `127.0.0.1` and `localhost` as the same RP ID). Vite forwards `/api` requests to Hono at `127.0.0.1:3300`; use `/api/health` to check the connection.

On first launch with no accounts, the app asks you to create the first account with an email address, a display name, and a passkey. There is no password. Later signups are only offered when `ENABLE_SIGNUP=true`; this setting is enforced on the server as well as in the UI.

## Production

Run `bun run build`, then `bun run start` from the repository root. Set the environment variables above and apply migrations before starting. Hono serves the built UI and API together at `http://127.0.0.1:3300`. Set `BETTER_AUTH_URL` to the public origin and configure the passkey RP ID/origin for that host. On a VPS, put this local listener behind Cloudflare Access before exposing it.
