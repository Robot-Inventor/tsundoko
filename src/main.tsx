import "./index.css";
import { detectLocale, saveLocale } from "./lib/locale";
import { App } from "./app";
import { createRoot } from "react-dom/client";
import { syncThemeCookie } from "./lib/theme";

syncThemeCookie();
saveLocale(detectLocale());
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", syncThemeCookie);

const root = document.querySelector("#root");

if (root) {
    createRoot(root).render(<App />);
}
