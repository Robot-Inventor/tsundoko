import { isIP, isIPv6 } from "node:net";
import { isPublicAddress } from "./publicAddress";
import { lookup } from "node:dns/promises";

const bracketOffset = 1;

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
const resolvePublicAddresses = async (
    hostname: string,
    lookupAddresses: AddressLookup = defaultLookup
): Promise<string[]> => {
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

// A name with several validated addresses needs its own fallback: the baked-in connection has no
// Happy Eyeballs, so a dual-stack host whose first record is unusable would otherwise fail.
const fetchFirstReachableAddress = async (url: URL, addresses: string[], init: RequestInit): Promise<Response> => {
    const [address, ...remaining] = addresses;

    if (!address) {
        throw new Error("The hostname does not resolve to a public address");
    }

    try {
        return await fetchFromAddress(url, address, init);
    } catch (error) {
        if (!remaining.length) {
            throw error;
        }

        return fetchFirstReachableAddress(url, remaining, init);
    }
};

const publicFetch = async (
    url: URL,
    init: RequestInit = {},
    resolve: AddressLookup = defaultLookup
): Promise<Response> => {
    const addresses = await resolvePublicAddresses(url.hostname, resolve);

    return fetchFirstReachableAddress(url, addresses, init);
};

export { publicFetch };
