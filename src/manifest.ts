// Web app manifest members are snake_case by specification.
// oxlint-disable eslint-core-js/camelcase

import type { AppTheme } from "./lib/appTheme";

interface AppIcon {
    purpose?: "maskable";
    sizes: string;
    src: string;
    type: string;
}

interface AppManifest {
    background_color: string;
    description: string;
    dir: string;
    display: string;
    icons: AppIcon[];
    id: string;
    lang: string;
    name: string;
    scope: string;
    share_target: {
        action: string;
        method: string;
        params: {
            text: string;
            title: string;
            url: string;
        };
    };
    short_name: string;
    shortcuts: Array<{
        icons: AppIcon[];
        name: string;
        url: string;
    }>;
    start_url: string;
    theme_color: string;
}

// Keep in sync with the theme-color meta tags in index.html.
const manifestColors = {
    dark: {
        background: "#0a0a0a",
        theme: "#0a0a0a"
    },
    light: {
        background: "#ffffff",
        theme: "#ffffff"
    }
} as const satisfies Record<AppTheme, { background: string; theme: string }>;

const appIcons = (theme: AppTheme): AppIcon[] => [
    {
        sizes: "192x192",
        src: `/icons/${theme}/icon-192.png`,
        type: "image/png"
    },
    {
        sizes: "512x512",
        src: `/icons/${theme}/icon-512.png`,
        type: "image/png"
    },
    {
        purpose: "maskable",
        sizes: "512x512",
        src: `/icons/${theme}/icon-maskable-512.png`,
        type: "image/png"
    }
];

const shortcutIcons = (theme: AppTheme): AppIcon[] => [
    {
        sizes: "192x192",
        src: `/icons/${theme}/icon-192.png`,
        type: "image/png"
    }
];

const appManifest = (theme: AppTheme): AppManifest => ({
    background_color: manifestColors[theme].background,
    description: "Lightweight, AI-first bookmarking app",
    dir: "ltr",
    display: "standalone",
    icons: appIcons(theme),
    id: "/",
    lang: "ja",
    name: "Tsundoko",
    scope: "/",
    share_target: {
        action: "/share",
        method: "GET",
        params: {
            text: "text",
            title: "title",
            url: "url"
        }
    },
    short_name: "Tsundoko",
    shortcuts: [
        {
            icons: shortcutIcons(theme),
            name: "ホーム",
            url: "/"
        },
        {
            icons: shortcutIcons(theme),
            name: "アーカイブ",
            url: "/archive"
        }
    ],
    start_url: "/",
    theme_color: manifestColors[theme].theme
});

interface ThemePreference {
    cookie?: string | undefined;
    hint?: string | undefined;
}

const parseTheme = ({ cookie, hint }: ThemePreference): AppTheme => {
    const hinted = hint?.replaceAll('"', "").trim();

    if (hinted === "dark" || hinted === "light") {
        return hinted;
    }

    // The cookie mirrors the last theme the page saw; anything other than "dark" means light.
    return cookie === "dark" ? "dark" : "light";
};

export { appManifest, parseTheme };
