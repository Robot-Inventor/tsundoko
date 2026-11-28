import type { BookmarkApi } from "../bookmarkApi";
import { authFetch } from "./authFetch";
import { hc } from "hono/client";

const bookmarkClient = hc<BookmarkApi>("/", { fetch: authFetch });

export { bookmarkClient };
