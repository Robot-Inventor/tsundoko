# Tsundoko

Lightweight, AI-first bookmarking app

## Development

Install dependencies with `bun install`, then copy `.env.example` to `.env` and set `DATABASE_URL` to your PostgreSQL (13 or later) connection string. Create the database, then apply migrations with `bun run migrate:apply`. Run `bun run migrate:create` after changing `src/db/schema.ts` to generate a new migration.

Run `bun run dev` to start both Vite and Hono. Open the URL printed by Vite. Vite forwards `/api` requests to Hono at `127.0.0.1:3000`; use `/api/health` to check the connection.

## Production

Run `bun run build`, then `bun run start` from the repository root. Set `DATABASE_URL` in the environment and apply migrations before starting. Hono serves the built UI and API together at `http://127.0.0.1:3000`. On a VPS, put this local listener behind Cloudflare Access before exposing it.
