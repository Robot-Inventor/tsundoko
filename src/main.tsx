import "./index.css";
import { createRoot } from "react-dom/client";

const root = document.querySelector("#root");

if (root) {
    createRoot(root).render(
        <main>
            <h1>Tsundoko</h1>
        </main>
    );
}
