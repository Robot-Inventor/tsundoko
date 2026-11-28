// oxlint-disable import/max-dependencies -- The account API wires auth, avatars, locales, and passkeys.
import { type Account, readAccount } from "./lib/account";
import { RateLimiterRes, createGate } from "./lib/outboundLimit";
import { isAvatarType, renderAvatar } from "./lib/avatarImage";
import type { AuthEnv } from "./authMiddleware";
import { Hono } from "hono";
import { apiError } from "./lib/apiError";
import { bodyLimit } from "hono/body-limit";
import { createRateLimit } from "./lib/rateLimit";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { httpStatus } from "./lib/httpStatus";
import { passkeyApi } from "./passkeyApi";
import { requestBodyLimit } from "./lib/requestBodyLimit";
import { sortByValues } from "./lib/bookmarkSort";
import { type } from "arktype";
import { user } from "./db/auth-schema";

const maxAvatarBytes = 5_242_880;
const avatarRequestLimit = 10;
// A decode can expand a 5 MiB upload to 16 megapixels, so only a couple may run at once. One slot
// per account keeps parallel uploads from filling the pool on their own.
const maxConcurrentAvatarDecodes = 2;
const maxConcurrentAvatarDecodesPerUser = 1;

const avatarRateLimit = createRateLimit({ limit: avatarRequestLimit });
const runAvatarDecode = createGate(maxConcurrentAvatarDecodes, maxConcurrentAvatarDecodesPerUser);
// Distinguishes a busy decoder from a corrupt upload: both have no URL, but only one is retriable.
const avatarBusy = Symbol("avatarBusy");

const accountPatchRequest = type({
    "locale?": '"ja" | "en"',
    "sortByActive?": type.enumerated(...sortByValues),
    "sortByArchived?": type.enumerated(...sortByValues)
});

const accountApi = new Hono<AuthEnv>()
    .get("/api/me", async (context) => {
        context.header("Cache-Control", "no-store");

        const account = await readAccount(context.get("userId"), context.get("sessionStartedAt"));

        if (!account) {
            return context.json(apiError("auth.accountNotFound"), httpStatus.notFound);
        }

        return context.json(account, httpStatus.ok);
    })
    .patch("/api/me", requestBodyLimit("auth.tooLong"), async (context) => {
        context.header("Cache-Control", "no-store");

        const body: unknown = await context.req.json().catch(() => null);
        const parsed = accountPatchRequest(body);

        if (parsed instanceof type.errors) {
            const invalidLocale = typeof body === "object" && body !== null && "locale" in body;

            return context.json(
                apiError(invalidLocale ? "auth.invalidLocale" : "auth.invalidSortBy"),
                httpStatus.badRequest
            );
        }

        const update: Partial<Pick<typeof user.$inferInsert, "locale" | "sortByActive" | "sortByArchived">> = {};

        if ("locale" in parsed) {
            update.locale = parsed.locale;
        }

        if ("sortByActive" in parsed) {
            update.sortByActive = parsed.sortByActive;
        }

        if ("sortByArchived" in parsed) {
            update.sortByArchived = parsed.sortByArchived;
        }

        if (Object.keys(update).length) {
            await db
                .update(user)
                .set(update)
                .where(eq(user.id, context.get("userId")));
        }

        return context.body(null, httpStatus.noContent);
    })
    .post(
        "/api/me/avatar",
        avatarRateLimit,
        bodyLimit({
            maxSize: maxAvatarBytes,
            onError: (context) => context.json(apiError("auth.avatarTooLarge"), httpStatus.payloadTooLarge)
        }),
        async (context) => {
            const contentType = context.req.header("content-type") ?? "";

            if (!isAvatarType(contentType)) {
                return context.json(apiError("auth.invalidAvatarType"), httpStatus.unsupportedMediaType);
            }

            const bytes = new Uint8Array(await context.req.arrayBuffer());

            // sharp reports unsupported or corrupt data by throwing; both mean the upload is unusable.
            // The gate rejects with RateLimiterRes when all decode slots are taken.
            const avatarUrl = await runAvatarDecode(context.get("userId"), () =>
                renderAvatar(bytes).catch(() => null)
            ).catch((error: unknown): string | null | typeof avatarBusy => {
                if (error instanceof RateLimiterRes) {
                    return avatarBusy;
                }

                throw error;
            });

            if (avatarUrl === avatarBusy) {
                context.header("Retry-After", "1");

                return context.json(apiError("rateLimit"), httpStatus.tooManyRequests);
            }

            if (!avatarUrl) {
                return context.json(apiError("auth.avatarReadFailed"), httpStatus.badRequest);
            }

            await db
                .update(user)
                .set({ image: avatarUrl })
                .where(eq(user.id, context.get("userId")));

            return context.body(null, httpStatus.noContent);
        }
    )
    .delete("/api/me/avatar", avatarRateLimit, async (context) => {
        await db
            .update(user)
            .set({ image: null })
            .where(eq(user.id, context.get("userId")));

        return context.body(null, httpStatus.noContent);
    })
    // The passkey routes live in their own module; they share this API's auth variables.
    .route("/", passkeyApi);

type AccountApi = typeof accountApi;

export { type Account, accountApi, type AccountApi };
