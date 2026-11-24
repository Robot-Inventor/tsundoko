import { auth } from "./lib/auth";
import { createMiddleware } from "hono/factory";
import { httpStatus } from "./lib/httpStatus";

interface AuthEnv {
    Variables: {
        userId: string;
    };
}

const requireAuth = createMiddleware<AuthEnv>(async (context, next) => {
    const session = await auth.api.getSession({ headers: context.req.raw.headers });

    if (!session) {
        return context.json({ error: "ログインが必要です。" }, httpStatus.unauthorized);
    }

    context.set("userId", session.user.id);

    return next();
});

export { type AuthEnv, requireAuth };
