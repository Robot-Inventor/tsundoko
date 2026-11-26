import { Hono } from "hono";
import { apiError } from "./lib/apiError";
import { createRateLimit } from "./lib/rateLimit";
import { httpStatus } from "./lib/httpStatus";
import { listTags } from "./db/tags";

const tagListLimit = 60;

const tagApi = new Hono<{ Variables: { userId: string } }>().get(
    "/api/tags",
    createRateLimit({ limit: tagListLimit }),
    async (context) => {
        context.header("Cache-Control", "no-store");

        try {
            return context.json(await listTags(context.get("userId")), httpStatus.ok);
        } catch {
            return context.json(apiError("tag.loadFailed"), httpStatus.internalServerError);
        }
    }
);

type TagApi = typeof tagApi;

export { type TagApi, tagApi };
