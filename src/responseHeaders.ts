import type { Context, MiddlewareHandler } from "hono";

// Vite emits hashed module scripts and same-origin stylesheets, so the SPA needs nothing beyond
// 'self'. Inline style attributes set through the DOM (React's style prop) are not covered by
// style-src, so they keep working.
const contentSecurityPolicy = [
    "default-src 'self'",
    "img-src 'self' data:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'"
].join("; ");

const strictTransportSecurity = "max-age=31536000";

const isHttpsRequest = (context: Context): boolean =>
    new URL(context.req.url).protocol === "https:" || context.req.header("x-forwarded-proto") === "https";

// Every response opts in to the color-scheme hint. The manifest is served per theme, and the
// manifest request that follows a document load only carries the hint after this opt-in.
const responseHeaders: MiddlewareHandler = async (context, next) => {
    await next();

    context.header("accept-ch", "Sec-CH-Prefers-Color-Scheme");
    context.header("content-security-policy", contentSecurityPolicy);
    context.header("x-content-type-options", "nosniff");
    context.header("referrer-policy", "no-referrer");

    // Browsers ignore HSTS on plain HTTP, but the deployment reaches the app through a TLS proxy,
    // so the forwarded scheme decides whether the header is meaningful.
    if (isHttpsRequest(context)) {
        context.header("strict-transport-security", strictTransportSecurity);
    }
};

export { responseHeaders };
