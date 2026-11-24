import { arkenv, type } from "@arkenv/core";

const env = arkenv(
    {
        BETTER_AUTH_SECRET: "string >= 32",
        BETTER_AUTH_URL: "string.url",
        DATABASE_URL: "string.url",
        // Semantic search stays off until a key names an OpenAI-compatible embeddings endpoint.
        EMBEDDING_API_KEY: type("string").optional(),
        EMBEDDING_BASE_URL: 'string.url = "https://api.openai.com/v1"',
        EMBEDDING_MODEL: 'string = "text-embedding-3-small"',
        ENABLE_SIGNUP: "boolean = false"
    },
    // Deployment templates often leave optional keys empty; an empty value should mean "unset".
    { emptyAsUndefined: true }
);

export { env };
