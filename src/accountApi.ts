// oxlint-disable import/max-dependencies -- The account API wires auth, avatars, locales, and passkeys.
import { type Account, readAccount } from "./lib/account";
import { isAvatarType, renderAvatar } from "./lib/avatarImage";
import type { AuthEnv } from "./authMiddleware";
import { Hono } from "hono";
import { apiError } from "./lib/apiError";
import { bodyLimit } from "hono/body-limit";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { httpStatus } from "./lib/httpStatus";
import { passkeyApi } from "./passkeyApi";
import { type } from "arktype";
import { user } from "./db/auth-schema";

const maxAvatarBytes = 5_242_880;

const localeRequest = type({ locale: '"ja" | "en"' });

const accountApi = new Hono<AuthEnv>()
    .get("/api/me", async (context) => {
        context.header("Cache-Control", "no-store");

        const account = await readAccount(context.get("userId"), context.get("sessionStartedAt"));

        if (!account) {
            return context.json(apiError("auth.accountNotFound"), httpStatus.notFound);
        }

        return context.json(account, httpStatus.ok);
    })
    .patch("/api/me", async (context) => {
        context.header("Cache-Control", "no-store");

        const parsed = localeRequest(await context.req.json().catch(() => null));

        if (parsed instanceof type.errors) {
            return context.json(apiError("auth.invalidLocale"), httpStatus.badRequest);
        }

        await db
            .update(user)
            .set({ locale: parsed.locale })
            .where(eq(user.id, context.get("userId")));

        return context.body(null, httpStatus.noContent);
    })
    .post(
        "/api/me/avatar",
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
            const avatarUrl = await renderAvatar(bytes).catch(() => null);

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
    .delete("/api/me/avatar", async (context) => {
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
