import { isIP, isIPv6 } from "node:net";
import { httpStatus } from "./httpStatus";
import { isPublicAddress } from "./publicAddress";
import { lookup } from "node:dns/promises";

const bracketOffset = 1;
const maxRedirects = 5;
const redirectStatuses = new Set<number>([
    httpStatus.found,
    httpStatus.movedPermanently,
    httpStatus.permanentRedirect,
    httpStatus.seeOther,
    httpStatus.temporaryRedirect
]);

// Bun's fetch extensions that are not part of RequestInit.
interface FetchOptions extends RequestInit {
    proxy?: false;
    tls?: {
        serverName: string;
    };
}

// URL.hostname keeps the brackets around an IPv6 literal; DNS and URL APIs want the bare address.
const stripBrackets = (hostname: string): string =>
    hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(bracketOffset, -bracketOffset) : hostname;

interface LookupAddress {
    address: string;
    family: number;
}

type AddressLookup = (hostname: string) => Promise<LookupAddress[]>;

const defaultLookup: AddressLookup = (hostname) => lookup(hostname, { all: true, order: "verbatim" });

// Resolve and validate before connecting. If any resolved address is private, the whole hostname is
// rejected, so round-robin DNS cannot alternate a public and an internal answer.
const resolvePublicAddresses = async (hostname: string, lookupAddresses: AddressLookup): Promise<string[]> => {
    const literal = stripBrackets(hostname);

    if (isIP(literal)) {
        if (!isPublicAddress(literal)) {
            throw new Error("The address is not public");
        }

        return [literal];
    }

    const addresses = await lookupAddresses(hostname);
    const [first] = addresses;

    if (!first || addresses.some((entry) => !isPublicAddress(entry.address))) {
        throw new Error("The hostname does not resolve to a public address");
    }

    return addresses.map((entry) => entry.address);
};

// Connect through the validated IP so a second DNS answer cannot move the connection to an internal
// address. The Host header and TLS server name keep the request addressed to the original host.
const fetchFromAddress = async (url: URL, address: string, init: RequestInit): Promise<Response> => {
    const target = new URL(url);

    target.hostname = isIPv6(address) ? `[${address}]` : address;

    const headers = new Headers(init.headers);
    headers.set("host", url.host);

    // A proxy decision based on the rewritten IP would be wrong, and an HTTPS proxy would receive
    // the target's TLS options. This app talks to the internet directly.
    const options: FetchOptions = {
        ...init,
        headers,
        proxy: false,
        redirect: "manual"
    };

    if (url.protocol === "https:") {
        options.tls = {
            serverName: stripBrackets(url.hostname)
        };
    }

    return fetch(target, options);
};

// Resolves the hostname to validated public addresses and dials the first one that connects.
const fetchResolvedAddress = async (url: URL, init: RequestInit, resolve: AddressLookup): Promise<Response> => {
    const addresses = await resolvePublicAddresses(url.hostname, resolve);
    let failure: unknown = null;

    // A name with several validated addresses needs its own fallback: the baked-in connection has no
    // Happy Eyeballs, so a dual-stack host whose first record is unusable would otherwise fail.
    for (const address of addresses) {
        try {
            // oxlint-disable-next-line no-await-in-loop -- The next address is only dialed after this one fails.
            return await fetchFromAddress(url, address, init);
        } catch (error) {
            failure = error;
        }
    }

    throw failure;
};

// Only http(s) without embedded credentials is fetchable. Redirect targets come from the remote
// server, so every hop is held to this rule before it is resolved and dialed.
const isFetchableUrl = (url: URL): boolean =>
    (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password;

// Follows redirects itself so each hop is re-resolved and re-validated; a 302 can never move an
// approved URL onto an internal address. The shared deadline travels in `init.signal`, covering the
// whole chain. The final `url` is reported in original-hostname form because `response.url` holds
// the rewritten IP this fetch dialed.
const publicFetch = async (
    input: URL,
    init: RequestInit = {},
    resolve: AddressLookup = defaultLookup
): Promise<{ response: Response; url: URL }> => {
    let url = input;
    let hopsFollowed = 0;

    for (;;) {
        if (!isFetchableUrl(url)) {
            throw new Error("Only public http and https URLs are fetchable");
        }

        // oxlint-disable-next-line no-await-in-loop -- Hops are sequential: a redirect is only fetched after the previous response.
        const response = await fetchResolvedAddress(url, init, resolve);

        if (!redirectStatuses.has(response.status)) {
            return {
                response,
                url
            };
        }

        // oxlint-disable-next-line no-await-in-loop -- Hops are sequential: a redirect is only fetched after the previous response.
        await response.body?.cancel();

        const location = response.headers.get("location");

        if (!location || hopsFollowed === maxRedirects) {
            throw new Error("The redirect could not be followed");
        }

        hopsFollowed++;
        url = new URL(location, url);
    }
};

export { publicFetch };
