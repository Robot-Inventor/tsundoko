import { type Plugin, defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { apiPort } from "./src/apiPort.ts";

// ArkType 2 probes eval support before it reads any jitless config, and the blocked attempt is
// reported as a CSP violation even though it is caught. Make the probe report a restricted
// environment so validation stays interpreted. https://github.com/arktypeio/arktype/issues/1473
const arktypeCspProbe = {
    name: "arktype-csp-probe",
    transform(code, id): string | undefined {
        if (!id.includes("@ark/util/out/functions.js")) {
            return;
        }

        return code.replace('new Function("return false")()', "true");
    }
} satisfies Plugin;

export default defineConfig({
    plugins: [react({ compiler: true }), tailwindcss(), arktypeCspProbe],
    server: {
        // The manifest is served per color scheme; the origin has to opt in to the hint for the
        // manifest request to carry it.
        headers: {
            "accept-ch": "Sec-CH-Prefers-Color-Scheme"
        },
        proxy: {
            "/api": `http://127.0.0.1:${apiPort}`,
            "/manifest.webmanifest": `http://127.0.0.1:${apiPort}`
        }
    }
});
