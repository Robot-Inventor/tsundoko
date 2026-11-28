// oxlint-disable import/max-dependencies -- The route wires auth, storage, and validation.
import { and, desc, eq } from "drizzle-orm";
import { normalizeTokenPermissions, parseStoredTokenPermissions, tokenPermissions } from "./lib/tokenPermissions";
import type { AuthEnv } from "./authMiddleware";
import { Hono } from "hono";
import { apiError } from "./lib/apiError";
import { apikey } from "./db/auth-schema";
import { auth } from "./lib/auth";
import { db } from "./db";
import { httpStatus } from "./lib/httpStatus";
import { requestBodyLimit } from "./lib/requestBodyLimit";
import { type } from "arktype";

const maxTokenNameLength = 32;
const maxTokenExpiryDays = 365;
const defaultTokenExpiryDays = 90;
const minimumTokenNameLength = 1;
const minimumTokenExpiryDays = 1;
const secondsPerDay = 86_400;

const createTokenRequest = type({
    expiresInDays: type("number.integer")
        .atLeast(minimumTokenExpiryDays)
        .atMost(maxTokenExpiryDays)
        .or("null")
        .default(defaultTokenExpiryDays),
    name: type("string.trim").to(type("string").atLeastLength(minimumTokenNameLength).atMostLength(maxTokenNameLength)),
    permissions: tokenPermissions
});

// The plugin's create endpoint rejects permissions from browser calls, so this route runs the
// server-side API itself after the cookie session has established the owner.
const tokenApi = new Hono<AuthEnv>()
    .get("/api/tokens", async (context) => {
        context.header("Cache-Control", "no-store");

        try {
            const rows = await db
                .select({
                    createdAt: apikey.createdAt,
                    expiresAt: apikey.expiresAt,
                    id: apikey.id,
                    lastRequest: apikey.lastRequest,
                    name: apikey.name,
                    permissions: apikey.permissions,
                    start: apikey.start
                })
                .from(apikey)
                .where(eq(apikey.referenceId, context.get("userId")))
                .orderBy(desc(apikey.createdAt));

            return context.json(
                rows.map((row) => ({
                    createdAt: row.createdAt.toISOString(),
                    expiresAt: row.expiresAt?.toISOString() ?? null,
                    id: row.id,
                    lastRequest: row.lastRequest?.toISOString() ?? null,
                    name: row.name,
                    permissions: parseStoredTokenPermissions(row.permissions),
                    start: row.start
                })),
                httpStatus.ok
            );
        } catch {
            return context.json(apiError("token.loadFailed"), httpStatus.internalServerError);
        }
    })
    .post("/api/tokens", requestBodyLimit("token.invalid"), async (context) => {
        context.header("Cache-Control", "no-store");

        const parsed = createTokenRequest(await context.req.json().catch(() => null));

        if (parsed instanceof type.errors) {
            return context.json(apiError("token.invalid"), httpStatus.badRequest);
        }

        const permissions = normalizeTokenPermissions(parsed.permissions.bookmarks);

        if (!permissions.bookmarks.length) {
            return context.json(apiError("token.invalid"), httpStatus.badRequest);
        }

        try {
            const created = await auth.api.createApiKey({
                body: {
                    ...(parsed.expiresInDays === null
                        ? {}
                        : {
                              expiresIn: parsed.expiresInDays * secondsPerDay
                          }),
                    name: parsed.name,
                    permissions: {
                        bookmarks: permissions.bookmarks
                    },
                    userId: context.get("userId")
                }
            });

            return context.json(
                {
                    createdAt: created.createdAt.toISOString(),
                    expiresAt: created.expiresAt?.toISOString() ?? null,
                    id: created.id,
                    lastRequest: null,
                    name: created.name,
                    permissions,
                    start: created.start ?? null,
                    token: created.key
                },
                httpStatus.created
            );
        } catch {
            return context.json(apiError("token.saveFailed"), httpStatus.internalServerError);
        }
    })
    .delete("/api/tokens/:id", async (context) => {
        context.header("Cache-Control", "no-store");
        const id = context.req.param("id").trim();

        try {
            const [deleted] = await db
                .delete(apikey)
                .where(and(eq(apikey.id, id), eq(apikey.referenceId, context.get("userId"))))
                .returning({ id: apikey.id });

            return deleted
                ? context.body(null, httpStatus.noContent)
                : context.json(apiError("token.notFound"), httpStatus.notFound);
        } catch {
            return context.json(apiError("token.saveFailed"), httpStatus.internalServerError);
        }
    });

export { tokenApi };
