import { arkenv } from "@arkenv/core";

const env = arkenv({
    BETTER_AUTH_SECRET: "string >= 32",
    BETTER_AUTH_URL: "string.url",
    DATABASE_URL: "string.url",
    ENABLE_SIGNUP: "boolean = false"
});

export { env };
