import { type TestDatabase, containerTimeoutMs, startTestDatabase } from "./db/testDatabase";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { user } from "./db/auth-schema";

const registeredEmail = "registered@example.com";
const unregisteredEmail = "unregistered@example.com";
const okStatus = 200;

const state: { current?: TestDatabase } = {};

beforeAll(async () => {
    const setup = await startTestDatabase();

    await setup.database.insert(user).values({
        createdAt: new Date(),
        email: registeredEmail,
        id: crypto.randomUUID(),
        name: "Registered",
        updatedAt: new Date()
    });

    process.env.BETTER_AUTH_SECRET = "test-secret-at-least-thirty-two-characters";
    process.env.BETTER_AUTH_URL = "http://localhost:3300";
    process.env.DATABASE_URL = setup.connectionUri;
    process.env.ENABLE_SIGNUP = "true";

    state.current = setup;

    vi.resetModules();
}, containerTimeoutMs);

afterAll(async () => {
    await state.current?.client.end();
});

const requestSignupContext = async (email: string): Promise<Response> => {
    const { authApi } = await import("./authApi");

    return authApi.request("/api/auth/signup-context", {
        body: JSON.stringify({ email, name: "Test" }),
        headers: {
            "content-type": "application/json"
        },
        method: "POST"
    });
};

describe("signup context", () => {
    it("answers a registered address and a new one the same way", async () => {
        const registered = await requestSignupContext(registeredEmail);
        const unregistered = await requestSignupContext(unregisteredEmail);

        expect(registered.status).toBe(okStatus);
        expect(unregistered.status).toBe(okStatus);
        await expect(registered.json()).resolves.toHaveProperty("token");
        await expect(unregistered.json()).resolves.toHaveProperty("token");
    });
});
