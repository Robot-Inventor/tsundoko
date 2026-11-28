import { trackingParamRules } from "./trackingParamRules";

type ParamMatcher =
    | {
          readonly kind: "all";
      }
    | {
          readonly kind: "name";
          readonly name: string;
      }
    | {
          readonly kind: "pattern";
          readonly pattern: RegExp;
      };

interface RuleTarget {
    readonly host: string;
    readonly pathPrefix: string;
}

interface TrackingParamRule {
    readonly exception: boolean;
    readonly exceptHosts: readonly string[];
    readonly hosts: readonly string[];
    readonly matcher: ParamMatcher;
    readonly pathPrefix: string;
}

// Commas inside a regex value must survive the option split, e.g. /^kk=\w{6,}/.
const splitOptions = (options: string): string[] => {
    const escapedComma = "\u0001";
    const protectedOptions = options.replace(/\/(?:\\.|[^/])*\//gu, (pattern) => pattern.replaceAll(",", escapedComma));

    return protectedOptions.split(",").map((option) => option.replaceAll(escapedComma, ","));
};

const parseMatcher = (option: string): ParamMatcher | null => {
    if (option === "removeparam") {
        return {
            kind: "all"
        };
    }

    const value = option.slice("removeparam=".length);

    if (!value.startsWith("/")) {
        return {
            kind: "name",
            name: value
        };
    }

    const pattern = /^\/(?<source>.*)\/(?<flags>[a-z]*)$/u.exec(value);
    const source = pattern?.groups?.["source"];
    const flags = pattern?.groups?.["flags"];

    if (typeof source !== "string" || typeof flags !== "string") {
        return null;
    }

    return {
        kind: "pattern",
        pattern: new RegExp(source, flags)
    };
};

// Supports global rules, ||host^, ||host/path^ and ||host. patterns. Path prefixes are literal;
// wildcard paths and targets with a query or fragment are skipped.
const parseTarget = (target: string): RuleTarget | null => {
    if (target === "") {
        return {
            host: "",
            pathPrefix: ""
        };
    }

    const match = /^\|\|(?<host>[^/?&#^]+)(?<path>\/[^?&#^]*)?(?:\^)?$/u.exec(target);
    const host = match?.groups?.["host"];
    const path = match?.groups?.["path"];

    if (typeof host !== "string") {
        return null;
    }

    return {
        host: host.endsWith(".") ? `${host}*` : host,
        pathPrefix: typeof path === "string" ? path : ""
    };
};

const parseDomains = (options: readonly string[]): { exceptHosts: readonly string[]; hosts: string[] } => {
    const domainOption = options.find((option) => option.startsWith("domain="));
    const domainParts = domainOption ? domainOption.slice("domain=".length).split("|") : ([] as const);
    const hosts = domainParts.filter((part) => !part.startsWith("~"));
    const exceptHosts = domainParts.filter((part) => part.startsWith("~")).map((part) => part.replace(/^~/u, ""));

    return {
        exceptHosts,
        hosts
    };
};

const parseRule = (line: string): TrackingParamRule | null => {
    const exception = line.startsWith("@@");
    const body = exception ? line.replace(/^@@/u, "") : line;
    const parts = /^(?<target>[^$]*)\$(?<options>.*)$/u.exec(body);
    const target = parts?.groups?.["target"];
    const rawOptions = parts?.groups?.["options"];

    if (typeof target !== "string" || typeof rawOptions !== "string") {
        return null;
    }

    const targetRule = parseTarget(target);
    const options = splitOptions(rawOptions);
    const paramOption = options.find((option) => option === "removeparam" || option.startsWith("removeparam="));
    const matcher = paramOption ? parseMatcher(paramOption) : null;

    if (matcher === null || targetRule === null) {
        return null;
    }

    const domains = parseDomains(options);
    const { hosts } = domains;

    if (targetRule.host !== "") {
        hosts.unshift(targetRule.host);
    }

    return {
        exceptHosts: domains.exceptHosts,
        exception,
        hosts,
        matcher,
        pathPrefix: targetRule.pathPrefix
    };
};

const matchesHost = (hostname: string, pattern: string): boolean => {
    const normalized = pattern.toLowerCase().replace(/^\./u, "");

    if (!normalized.includes("*")) {
        return hostname === normalized || hostname.endsWith(`.${normalized}`);
    }

    const source = normalized.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&").replaceAll("\\*", ".*");

    return new RegExp(`^(?:[^.]+\\.)*${source}$`, "u").test(hostname);
};

const appliesTo = (rule: TrackingParamRule, url: URL): boolean => {
    if (rule.exceptHosts.some((pattern) => matchesHost(url.hostname, pattern))) {
        return false;
    }

    if (rule.pathPrefix && !url.pathname.startsWith(rule.pathPrefix)) {
        return false;
    }

    return !rule.hosts.length || rule.hosts.some((pattern) => matchesHost(url.hostname, pattern));
};

const matchesParam = (matcher: ParamMatcher, key: string, pair: string): boolean => {
    if (matcher.kind === "all") {
        return true;
    }

    if (matcher.kind === "name") {
        return key === matcher.name;
    }

    return matcher.pattern.test(pair);
};

const rules = trackingParamRules.map(parseRule).filter((rule): rule is TrackingParamRule => rule !== null);

const shouldRemove = (key: string, pair: string, url: URL): boolean => {
    let remove = false;
    let keep = false;

    for (const rule of rules) {
        if (appliesTo(rule, url) && matchesParam(rule.matcher, key, pair)) {
            if (rule.exception) {
                keep = true;
            } else {
                remove = true;
            }
        }
    }

    return remove && !keep;
};

const removeTrackingParams = (url: URL): void => {
    if (!url.search) {
        return;
    }

    const remaining = new URLSearchParams();
    let changed = false;

    for (const [key, value] of url.searchParams) {
        const pair = `${key}=${value}`;

        if (shouldRemove(key, pair, url)) {
            changed = true;
        } else {
            remaining.append(key, value);
        }
    }

    if (changed) {
        url.search = remaining.toString();
    }
};

export { removeTrackingParams };
