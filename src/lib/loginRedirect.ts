// Keep in step with router.tsx; a new page that can host a failed write needs adding here.
const appPaths = ["/", "/archive", "/settings", "/share"] as const;
const tagPath = /^\/tags\/[^/?#]+$/u;
const origin = "https://tsundoko.invalid";

const isRelativePath = (value: unknown): value is string =>
    typeof value === "string" && value.startsWith("/") && !value.startsWith("//");

// The return URL travels through the login page's own URL, so a tampered value must never become
// an off-site navigation after sign-in. Only known app routes, with their query and fragment, pass.
const isLoginRedirect = (value: unknown): value is string => {
    if (!isRelativePath(value)) {
        return false;
    }

    const url = new URL(value, origin);

    return url.origin === origin && (appPaths.some((path) => path === url.pathname) || tagPath.test(url.pathname));
};

export { isLoginRedirect };
