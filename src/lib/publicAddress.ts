import { BlockList, isIP } from "node:net";

const ipv4Family = 4;
const ipv6Family = 6;

// Ranges that must never be reached from a server-side fetch: unspecified, private, carrier-grade
// NAT, loopback, link-local, home, benchmark, multicast, and reserved.
const blockedIPv4Subnets = [
    ["0.0.0.0", "8"],
    ["10.0.0.0", "8"],
    ["100.64.0.0", "10"],
    ["127.0.0.0", "8"],
    ["169.254.0.0", "16"],
    ["172.16.0.0", "12"],
    ["192.168.0.0", "16"],
    ["198.18.0.0", "15"],
    ["224.0.0.0", "4"],
    ["240.0.0.0", "4"]
] as const;

// ::/96 covers the deprecated IPv4-compatible form (including :: and ::1), and ::ffff:0:0/96 the
// IPv4-mapped form, so ::ffff:127.0.0.1 cannot smuggle a loopback address past the IPv4 rules.
// fec0::/10 is the deprecated site-local range. NAT64 (64:ff9b::/96, 64:ff9b:1::/48) and 6to4
// (2002::/16) embed IPv4 addresses, so they are rejected as a class rather than parsed.
const blockedIPv6Subnets = [
    ["::", "96"],
    ["::ffff:0:0", "96"],
    ["64:ff9b::", "96"],
    ["64:ff9b:1::", "48"],
    ["2002::", "16"],
    ["fc00::", "7"],
    ["fec0::", "10"],
    ["fe80::", "10"],
    ["ff00::", "8"]
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

// Bun's BlockList answers IPv4 checks incorrectly once an IPv6 subnet shares the list, so the two
// families get separate instances.
const blockedIPv4 = new BlockList();
const blockedIPv6 = new BlockList();

addSubnets(blockedIPv4, blockedIPv4Subnets, "ipv4");
addSubnets(blockedIPv6, blockedIPv6Subnets, "ipv6");

// Anything that does not parse as an IP address is not a valid fetch target, so it is blocked.
const isPublicAddress = (address: string): boolean => {
    const family = isIP(address);

    if (family === ipv4Family) {
        return !blockedIPv4.check(address, "ipv4");
    }

    if (family === ipv6Family) {
        return !blockedIPv6.check(address, "ipv6");
    }

    return false;
};

export { isPublicAddress };
