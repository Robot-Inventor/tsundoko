import "./index.css";
import { App } from "./app";
import { createRoot } from "react-dom/client";
import { syncThemeCookie } from "./lib/theme";

syncThemeCookie();
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", syncThemeCookie);

const root = document.querySelector("#root");

if (root) {
    createRoot(root).render(<App />);
}
