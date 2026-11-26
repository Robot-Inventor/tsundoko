import { apiError } from "./lib/apiError";
import { auth } from "./lib/auth";
import { createMiddleware } from "hono/factory";
import { httpStatus } from "./lib/httpStatus";

interface AuthEnv {
    Variables: {
        userId: string;
        sessionStartedAt: Date;
    };
}

const requireAuth = createMiddleware<AuthEnv>(async (context, next) => {
    const session = await auth.api.getSession({ headers: context.req.raw.headers });

    if (!session) {
        return context.json(apiError("auth.loginRequired"), httpStatus.unauthorized);
    }

    context.set("userId", session.user.id);
    context.set("sessionStartedAt", new Date(session.session.createdAt));

    return next();
});

export { type AuthEnv, requireAuth };
