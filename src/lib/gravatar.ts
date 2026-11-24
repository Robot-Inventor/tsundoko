const avatarSize = 64;
const hexRadix = 16;
const byteHexDigits = 2;

// Gravatar hashes the trimmed, lowercased address; SHA-256 is the hash the current API documents.
const hashEmail = async (email: string): Promise<string> => {
    const bytes = new TextEncoder().encode(email.trim().toLowerCase());
    const digest = await crypto.subtle.digest("SHA-256", bytes);

    return Array.from(new Uint8Array(digest), (byte) => byte.toString(hexRadix).padStart(byteHexDigits, "0")).join("");
};

// d=404 makes an unregistered address fail to load, so the Avatar fallback shows the initial instead.
const getGravatarUrl = async (email: string): Promise<string> =>
    `https://gravatar.com/avatar/${await hashEmail(email)}?d=404&s=${String(avatarSize)}`;

export { getGravatarUrl };
