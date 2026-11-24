import type { AuthEnv } from "./authMiddleware";
import { Hono } from "hono";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { getGravatarUrl } from "./lib/gravatar";
import { httpStatus } from "./lib/httpStatus";
import { user } from "./db/auth-schema";

interface Account {
    avatarUrl: string;
    email: string;
    name: string;
}

const meApi = new Hono<AuthEnv>().get("/api/me", async (context) => {
    context.header("Cache-Control", "no-store");

    const [account] = await db
        .select({
            email: user.email,
            image: user.image,
            name: user.name
        })
        .from(user)
        .where(eq(user.id, context.get("userId")));

    if (!account) {
        return context.json({ error: "ユーザーが見つかりませんでした。" }, httpStatus.notFound);
    }

    const accountSummary: Account = {
        // A stored image wins, so a future custom avatar only has to fill user.image.
        avatarUrl: account.image ?? (await getGravatarUrl(account.email)),
        email: account.email,
        name: account.name
    };

    return context.json(accountSummary, httpStatus.ok);
});

type MeApi = typeof meApi;

export { type Account, meApi, type MeApi };
