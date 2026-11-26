import { deletePasskey, listPasskeySummaries } from "./lib/passkeyStore";
import { getPasskeyEditingDeadline, isPasskeyEditingAllowed } from "./lib/passkeyPolicy";
import type { AuthEnv } from "./authMiddleware";
import { Hono } from "hono";
import { apiError } from "./lib/apiError";
import { httpStatus } from "./lib/httpStatus";

const passkeyApi = new Hono<AuthEnv>()
    .get("/api/passkeys", async (context) => {
        context.header("Cache-Control", "no-store");

        return context.json(await listPasskeySummaries(context.get("userId")), httpStatus.ok);
    })
    .delete("/api/passkeys/:id", async (context) => {
        if (!isPasskeyEditingAllowed(getPasskeyEditingDeadline(context.get("sessionStartedAt")))) {
            return context.json(apiError("passkey.reauthenticate"), httpStatus.forbidden);
        }

        const result = await deletePasskey(context.get("userId"), context.req.param("id"));

        if (result === "last") {
            return context.json(apiError("passkey.deleteLast"), httpStatus.badRequest);
        }

        if (result === "not-found") {
            return context.json(apiError("passkey.notFound"), httpStatus.notFound);
        }

        return context.body(null, httpStatus.noContent);
    });

export { passkeyApi };
