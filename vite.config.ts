import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { apiPort } from "./src/apiPort.ts";

export default defineConfig({
    plugins: [react({ compiler: true }), tailwindcss()],
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
