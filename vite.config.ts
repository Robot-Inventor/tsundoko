import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { apiPort } from "./src/apiPort.ts";

export default defineConfig({
    plugins: [react({ compiler: true }), tailwindcss()],
    server: {
        proxy: {
            "/api": `http://127.0.0.1:${apiPort}`
        }
    }
});
