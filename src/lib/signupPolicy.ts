import { count, eq } from "drizzle-orm";
import { db } from "../db";
import { env } from "../env";
import { user } from "../db/auth-schema";

const noAccounts = 0;
const needsSetupCacheMs = 5_000;

const needsSetupCacheKey = "needsSetup";
const needsSetupCache = new Map<string, { expiresAt: number; value: boolean }>();

const countUsers = async (): Promise<number> => {
    const [result] = await db.select({ value: count() }).from(user);

    return result?.value ?? noAccounts;
};

const needsSetup = async (): Promise<boolean> => {
    const now = Date.now();
    const cached = needsSetupCache.get(needsSetupCacheKey);

    if (cached && cached.expiresAt > now) {
        return cached.value;
    }

    const value = (await countUsers()) === noAccounts;
    // The flag flips from true to false only once, so a short window cannot keep it stale for long.
    needsSetupCache.set(needsSetupCacheKey, {
        expiresAt: now + needsSetupCacheMs,
        value
    });

    return value;
};

const signupAllowed = async (): Promise<boolean> => (await countUsers()) === noAccounts || env.ENABLE_SIGNUP;

const emailTaken = async (email: string): Promise<boolean> => {
    const existing = await db.select({ id: user.id }).from(user).where(eq(user.email, email));

    return existing.length > noAccounts;
};

export { emailTaken, needsSetup, signupAllowed };
