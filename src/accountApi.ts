import { type Account, readAccount } from "./lib/account";
import { isAvatarType, renderAvatar } from "./lib/avatarImage";
import type { AuthEnv } from "./authMiddleware";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { httpStatus } from "./lib/httpStatus";
import { passkeyApi } from "./passkeyApi";
import { user } from "./db/auth-schema";

const maxAvatarBytes = 5_242_880;

const accountApi = new Hono<AuthEnv>()
    .get("/api/me", async (context) => {
        context.header("Cache-Control", "no-store");

        const account = await readAccount(context.get("userId"), context.get("sessionStartedAt"));

        if (!account) {
            return context.json({ error: "ユーザーが見つかりませんでした。" }, httpStatus.notFound);
        }

        return context.json(account, httpStatus.ok);
    })
    .post(
        "/api/me/avatar",
        bodyLimit({
            maxSize: maxAvatarBytes,
            onError: (context) => context.json({ error: "画像が大きすぎます。" }, httpStatus.payloadTooLarge)
        }),
        async (context) => {
            const contentType = context.req.header("content-type") ?? "";

            if (!isAvatarType(contentType)) {
                return context.json(
                    { error: "PNG・JPEG・WebPの画像を選択してください。" },
                    httpStatus.unsupportedMediaType
                );
            }

            const bytes = new Uint8Array(await context.req.arrayBuffer());

            // sharp reports unsupported or corrupt data by throwing; both mean the upload is unusable.
            const avatarUrl = await renderAvatar(bytes).catch(() => null);

            if (!avatarUrl) {
                return context.json({ error: "画像を読み込めませんでした。" }, httpStatus.badRequest);
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
