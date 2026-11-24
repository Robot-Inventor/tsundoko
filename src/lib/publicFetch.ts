import { isIP, isIPv6 } from "node:net";
import { isPublicAddress } from "./publicAddress";
import { lookup } from "node:dns/promises";

const bracketOffset = 1;

// URL.hostname keeps the brackets around an IPv6 literal; DNS and URL APIs want the bare address.
const stripBrackets = (hostname: string): string =>
    hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(bracketOffset, -bracketOffset) : hostname;

// Resolve and validate before connecting. If any resolved address is private, the whole hostname is
// rejected, so round-robin DNS cannot alternate a public and an internal answer.
const resolvePublicAddress = async (hostname: string): Promise<string> => {
    const literal = stripBrackets(hostname);

    if (isIP(literal)) {
        if (!isPublicAddress(literal)) {
            throw new Error("The address is not public");
        }

        return literal;
    }

    const addresses = await lookup(hostname, { all: true, order: "verbatim" });
    const [first] = addresses;

    if (!first || addresses.some((entry) => !isPublicAddress(entry.address))) {
        throw new Error("The hostname does not resolve to a public address");
    }

    return first.address;
};

// Fetch through the validated IP so a second DNS answer cannot move the connection to an internal
// address. The Host header and TLS server name keep the request addressed to the original host.
const publicFetch = async (url: URL, init: RequestInit = {}): Promise<Response> => {
    const address = await resolvePublicAddress(url.hostname);
    const target = new URL(url);

    target.hostname = isIPv6(address) ? `[${address}]` : address;

    const headers = new Headers(init.headers);
    headers.set("host", url.host);

    return fetch(target, {
        ...init,
        headers,
        redirect: "manual",
        ...(url.protocol === "https:"
            ? {
                  tls: {
                      serverName: stripBrackets(url.hostname)
                  }
              }
            : {})
    });
};

export { publicFetch };
