import { embeddingDimensions } from "../db/schema";
import { env } from "../env";
import { runOutbound } from "./outboundLimit";
import { type } from "arktype";

const requestTimeoutMs = 3000;
// One vector per bookmark is built from the start of the article body. The models behind the
// endpoint have token limits, and the opening section carries the topic a search is likely to match.
const maxContentLength = 6000;

const embeddingResponse = type({
    data: type({ embedding: "number[]" }).array()
});

const embeddingsEnabled = Boolean(env.EMBEDDING_API_KEY);

interface EmbeddingSource {
    content: string | null;
    description: string | null;
    title: string;
}

const embeddingInput = ({ content, description, title }: EmbeddingSource): string => {
    // oxlint-disable-next-line no-magic-numbers -- Keep the first `maxContentLength` characters.
    const contentPrefix = content?.slice(0, maxContentLength);

    return [title, description, contentPrefix].filter((part) => part?.trim()).join("\n");
};

// Search and save both treat an unavailable embedding as "no vector": the caller falls back to
// keyword search, or stores the bookmark with a NULL embedding so it can be backfilled later.
const embed = async (text: string): Promise<number[] | null> => {
    const apiKey = env.EMBEDDING_API_KEY;

    if (!apiKey) {
        return null;
    }

    try {
        // Provider docs usually show the base URL with a trailing slash; avoid a double slash.
        const endpoint = `${env.EMBEDDING_BASE_URL.replace(/\/+$/u, "")}/embeddings`;
        const response = await runOutbound("embedding", () =>
            fetch(endpoint, {
                body: JSON.stringify({ input: text, model: env.EMBEDDING_MODEL }),
                headers: {
                    authorization: `Bearer ${apiKey}`,
                    "content-type": "application/json"
                },
                method: "POST",
                signal: AbortSignal.timeout(requestTimeoutMs)
            })
        );

        // oxlint-disable-next-line no-magic-numbers -- 200 is the only success status for this endpoint.
        if (response.status !== 200) {
            await response.body?.cancel();
            // oxlint-disable-next-line no-console -- Server-side diagnostics are console's legitimate use.
            console.warn("Embedding request failed with status", response.status);

            return null;
        }

        const parsed = embeddingResponse(await response.json());

        if (parsed instanceof type.errors) {
            return null;
        }

        const vector = parsed.data[0]?.embedding;

        // A vector of the wrong size cannot be stored in the column; dropping it keeps the bookmark saveable.
        if (vector?.length !== embeddingDimensions) {
            // oxlint-disable-next-line no-console -- Server-side diagnostics are console's legitimate use.
            console.warn("Embedding dimensions do not match the bookmarks column.");

            return null;
        }

        return vector;
    } catch (error) {
        // oxlint-disable-next-line no-console -- Server-side diagnostics are console's legitimate use.
        console.warn("Embedding request failed:", error);

        return null;
    }
};

export { embed, embeddingInput, embeddingsEnabled };
