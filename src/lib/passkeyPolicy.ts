import { getAuthenticatorName } from "@better-auth/passkey";

const fallbackPasskeyName = "Passkey";

const secondsPerMinute = 60;
const millisecondsPerSecond = 1000;
const passkeyEditingMinutes = 15;

// The window a sign-in stays new enough to add or remove a passkey. authHooks applies it on the
// server and the settings page uses the same value for its countdown.
const passkeyEditingSeconds = passkeyEditingMinutes * secondsPerMinute;

const getPasskeyEditingDeadline = (sessionStartedAt: Date): Date =>
    new Date(sessionStartedAt.getTime() + passkeyEditingSeconds * millisecondsPerSecond);

const isPasskeyEditingAllowed = (deadline: Date, now: Date = new Date()): boolean => now.getTime() < deadline.getTime();

// Better Auth stores whatever name registration sent, which is empty for passkeys added from settings.
// The AAGUID names the authenticator model; privacy-preserving platforms report zeros, leaving the fallback.
const resolvePasskeyName = (name: string | null, aaguid: string | null): string => {
    const saved = name?.trim();

    if (saved) {
        return saved;
    }

    return getAuthenticatorName(aaguid) ?? fallbackPasskeyName;
};

export { getPasskeyEditingDeadline, isPasskeyEditingAllowed, resolvePasskeyName };
