import { db } from "../db";
import { eq } from "drizzle-orm";
import { getGravatarUrl } from "./gravatar";
import { getPasskeyEditingDeadline } from "./passkeyPolicy";
import { user } from "../db/auth-schema";

interface AccountSummary {
    avatarUrl: string;
    email: string;
    name: string;
}

interface Account extends AccountSummary {
    // When this passes, adding or removing a passkey needs a fresh sign-in; the settings page uses it
    // to disable those actions before the server has to reject them.
    passkeyEditableUntil: string;
}

const readAccount = async (userId: string, sessionStartedAt: Date): Promise<Account | null> => {
    const [row] = await db
        .select({
            email: user.email,
            image: user.image,
            name: user.name
        })
        .from(user)
        .where(eq(user.id, userId));

    if (!row) {
        return null;
    }

    return {
        // A stored image wins, so a custom avatar only has to fill user.image.
        avatarUrl: row.image ?? (await getGravatarUrl(row.email)),
        email: row.email,
        name: row.name,
        passkeyEditableUntil: getPasskeyEditingDeadline(sessionStartedAt).toISOString()
    };
};

export { type Account, readAccount };
