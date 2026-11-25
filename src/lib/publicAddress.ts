import { BlockList, isIP } from "node:net";

const ipv4Family = 4;
const ipv6Family = 6;

// Ranges that must never be reached from a server-side fetch: unspecified, private, carrier-grade
// NAT, loopback, link-local, home, benchmark, IETF protocol assignments, documentation, 6to4 relay
// anycast, multicast, and reserved.
const blockedIPv4Subnets = [
    ["0.0.0.0", "8"],
    ["10.0.0.0", "8"],
    ["100.64.0.0", "10"],
    ["127.0.0.0", "8"],
    ["169.254.0.0", "16"],
    ["172.16.0.0", "12"],
    ["192.0.0.0", "24"],
    ["192.0.2.0", "24"],
    ["192.88.99.0", "24"],
    ["192.168.0.0", "16"],
    ["198.18.0.0", "15"],
    ["198.51.100.0", "24"],
    ["203.0.113.0", "24"],
    ["224.0.0.0", "4"],
    ["240.0.0.0", "4"]
] as const;

// IPv6 is judged by allowlist instead of a deny list: 2000::/3 is the only range the IANA registry
// reserves for global unicast, so loopback, ULA, link-local, multicast, and every IPv4-embedding
// form (mapped, compatible, NAT64, 6to4) fails the check without being enumerated. The exceptions
// are the special-purpose ranges that live inside 2000::/3: IETF protocol assignments including
// Teredo, documentation, 6to4, and the newer documentation range 3fff::/20.
const allowedIPv6Subnets = [["2000::", "3"]] as const;
const blockedIPv6Subnets = [
    ["2001::", "23"],
    ["2001:db8::", "32"],
    ["2002::", "16"],
    ["3fff::", "20"]
] as const;

const addSubnets = (
    list: BlockList,
    subnets: ReadonlyArray<readonly [string, string]>,
    family: "ipv4" | "ipv6"
): void => {
    for (const [network, prefix] of subnets) {
        list.addSubnet(network, Number(prefix), family);
    }
};

// Each family gets its own instances: sharing one BlockList across families made IPv4 checks match
// unrelated addresses on Bun 1.4.5, and the IPv6 allowlist is checked against its own exceptions.
const blockedIPv4 = new BlockList();
const allowedIPv6 = new BlockList();
const blockedIPv6 = new BlockList();

addSubnets(blockedIPv4, blockedIPv4Subnets, "ipv4");
addSubnets(allowedIPv6, allowedIPv6Subnets, "ipv6");
addSubnets(blockedIPv6, blockedIPv6Subnets, "ipv6");

// Anything that does not parse as an IP address is not a valid fetch target, so it is blocked.
const isPublicAddress = (address: string): boolean => {
    const family = isIP(address);

    if (family === ipv4Family) {
        return !blockedIPv4.check(address, "ipv4");
    }

    if (family === ipv6Family) {
        return allowedIPv6.check(address, "ipv6") && !blockedIPv6.check(address, "ipv6");
    }

    return false;
};

export { isPublicAddress };
