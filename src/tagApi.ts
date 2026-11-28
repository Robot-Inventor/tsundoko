import { deleteTag, listTags, updateTag } from "./db/tags";
import { isValidTagColor, normalizeTagNames } from "./lib/tags";
import { tagListRateLimit, tagWriteRateLimit } from "./lib/rateLimits";
import { Hono } from "hono";
import { apiError } from "./lib/apiError";
import { httpStatus } from "./lib/httpStatus";
import { type } from "arktype";
import { validator } from "hono/validator";

const tagId = type("string.uuid");

const tagUpdateRequest = type({
    color: "string | null",
    name: "string"
});

const tagIdParam = validator("param", (value, context) => {
    const id = value["id"]?.trim() ?? "";

    return tagId(id) instanceof type.errors
        ? context.json(apiError("tag.notFound"), httpStatus.notFound)
        : {
              id
          };
});

const tagUpdatePayload = validator("json", (value, context) => {
    const parsed = tagUpdateRequest(value);

    if (parsed instanceof type.errors) {
        return context.json(apiError("tag.invalid"), httpStatus.badRequest);
    }

    const [name] = normalizeTagNames([parsed.name]) ?? [];
    const color = parsed.color?.toLowerCase() ?? null;

    if (!name) {
        return context.json(apiError("tag.invalidName"), httpStatus.badRequest);
    }

    if (!isValidTagColor(color)) {
        return context.json(apiError("tag.invalidColor"), httpStatus.badRequest);
    }

    return {
        color,
        name
    };
});

const tagApi = new Hono<{ Variables: { userId: string } }>()
    .get("/api/tags", tagListRateLimit, async (context) => {
        context.header("Cache-Control", "no-store");

        try {
            return context.json(await listTags(context.get("userId")), httpStatus.ok);
        } catch {
            return context.json(apiError("tag.loadFailed"), httpStatus.internalServerError);
        }
    })
    .patch("/api/tags/:id", tagWriteRateLimit, tagIdParam, tagUpdatePayload, async (context) => {
        context.header("Cache-Control", "no-store");
        const { id } = context.req.valid("param");
        const { color, name } = context.req.valid("json");

        try {
            const updated = await updateTag({ color, id, name, userId: context.get("userId") });

            return updated
                ? context.body(null, httpStatus.noContent)
                : context.json(apiError("tag.notFound"), httpStatus.notFound);
        } catch {
            return context.json(apiError("tag.saveFailed"), httpStatus.internalServerError);
        }
    })
    .delete("/api/tags/:id", tagWriteRateLimit, tagIdParam, async (context) => {
        context.header("Cache-Control", "no-store");
        const { id } = context.req.valid("param");

        try {
            const deleted = await deleteTag(id, context.get("userId"));

            return deleted
                ? context.body(null, httpStatus.noContent)
                : context.json(apiError("tag.notFound"), httpStatus.notFound);
        } catch {
            return context.json(apiError("tag.saveFailed"), httpStatus.internalServerError);
        }
    });

type TagApi = typeof tagApi;

export { type TagApi, tagApi };
