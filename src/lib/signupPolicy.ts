import { count, eq } from "drizzle-orm";
import { db } from "../db";
import { env } from "../env";
import { user } from "../db/auth-schema";

const noAccounts = 0;

const countUsers = async (): Promise<number> => {
    const [result] = await db.select({ value: count() }).from(user);

    return result?.value ?? noAccounts;
};

const needsSetup = async (): Promise<boolean> => (await countUsers()) === noAccounts;

const signupAllowed = async (): Promise<boolean> => (await countUsers()) === noAccounts || env.ENABLE_SIGNUP;

const emailTaken = async (email: string): Promise<boolean> => {
    const existing = await db.select({ id: user.id }).from(user).where(eq(user.email, email));

    return existing.length > noAccounts;
};

export { emailTaken, needsSetup, signupAllowed };
