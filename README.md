# Tsundoko

Lightweight, AI-first bookmarking app

## Development

Install dependencies with `bun install`, then run `bun run dev` to start both Vite and Hono. Open the URL printed by Vite. Vite forwards `/api` requests to Hono at `127.0.0.1:3000`; use `/api/health` to check the connection.

## Production

Run `bun run build`, then `bun run start` from the repository root. Hono serves the built UI and API together at `http://127.0.0.1:3000`. On a VPS, put this local listener behind Cloudflare Access before exposing it.
