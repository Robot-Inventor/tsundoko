import type { Context, MiddlewareHandler } from "hono";
import { randomBytes } from "node:crypto";

interface SecurityEnv {
    Variables: {
        cspNonce: string;
    };
}

const nonceBytes = 16;

// Vite emits hashed module scripts and same-origin stylesheets, so the SPA needs nothing beyond
// 'self'. Inline style attributes set through the DOM (React's style prop) are not covered by
// style-src, so they keep working. The nonce signs the stylesheets that Base UI and the color
// picker inject at runtime. https: covers both Gravatar avatars and images embedded in saved
// articles; referrer-policy below keeps their URLs from leaking the app's origin.
const contentSecurityPolicy = (nonce: string): string =>
    [
        "default-src 'self'",
        "img-src 'self' data: https:",
        `style-src 'self' 'nonce-${nonce}'`,
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "object-src 'none'"
    ].join("; ");

const strictTransportSecurity = "max-age=31536000";

// The app is reached through a TLS-terminating proxy, so the forwarded scheme is the only signal
// that the browser's connection is secure. A chain such as "https,http" names the client leg first.
const isHttpsRequest = (context: Context): boolean =>
    context.req.header("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase() === "https";

// Every response opts in to the color-scheme hint. The manifest is served per theme, and the
// manifest request that follows a document load only carries the hint after this opt-in.
const responseHeaders: MiddlewareHandler<SecurityEnv> = async (context, next) => {
    const nonce = randomBytes(nonceBytes).toString("base64");

    // The document embeds this value for the color picker, and the policy below authorizes it.
    context.set("cspNonce", nonce);

    await next();

    context.header("accept-ch", "Sec-CH-Prefers-Color-Scheme");
    context.header("content-security-policy", contentSecurityPolicy(nonce));
    context.header("x-content-type-options", "nosniff");
    context.header("referrer-policy", "no-referrer");

    // Browsers ignore HSTS on plain HTTP, so only send it when the proxy reports HTTPS.
    if (isHttpsRequest(context)) {
        context.header("strict-transport-security", strictTransportSecurity);
    }
};

export { type SecurityEnv, responseHeaders };
