import { httpStatus } from "./httpStatus";
import { tagClient } from "./tagClient";

type TagMutationFailure = "invalid" | "notFound" | "rateLimit" | "save";

type TagMutationResult = { failure: TagMutationFailure } | { ok: true };

const failureByStatus: Partial<Record<number, TagMutationFailure>> = {
    [httpStatus.badRequest]: "invalid",
    [httpStatus.notFound]: "notFound",
    [httpStatus.tooManyRequests]: "rateLimit"
};

interface TagUpdateInput {
    color: string | null;
    id: string;
    name: string;
}

const requestTagUpdate = async ({ color, id, name }: TagUpdateInput): Promise<TagMutationResult> => {
    try {
        const response = await tagClient.api.tags[":id"].$patch({
            json: {
                color,
                name
            },
            param: {
                id
            }
        });

        return response.ok
            ? {
                  ok: true
              }
            : {
                  failure: failureByStatus[response.status] ?? "save"
              };
    } catch {
        return {
            failure: "save"
        };
    }
};

const requestTagDelete = async (id: string): Promise<TagMutationResult> => {
    try {
        const response = await tagClient.api.tags[":id"].$delete({
            param: {
                id
            }
        });

        return response.ok
            ? {
                  ok: true
              }
            : {
                  failure: failureByStatus[response.status] ?? "save"
              };
    } catch {
        return {
            failure: "save"
        };
    }
};

export { type TagMutationFailure, requestTagDelete, requestTagUpdate };
