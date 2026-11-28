import "./index.css";
import { detectLocale, saveLocale } from "./lib/locale";
import { App } from "./app";
import { CSPProvider } from "@base-ui/react/csp-provider";
import { createRoot } from "react-dom/client";
import { setNonce } from "react-colorful";
import { syncThemeCookie } from "./lib/theme";

// Both the color picker and Base UI's Select build stylesheets at runtime; without the document's
// nonce a strict CSP blocks them.
const cspNonce = document.querySelector('meta[name="csp-nonce"]')?.getAttribute("content") ?? "";

if (cspNonce) {
    setNonce(cspNonce);
}

syncThemeCookie();
saveLocale(detectLocale());
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", syncThemeCookie);

const root = document.querySelector("#root");

if (root) {
    createRoot(root).render(
        <CSPProvider nonce={cspNonce}>
            <App />
        </CSPProvider>
    );
}
