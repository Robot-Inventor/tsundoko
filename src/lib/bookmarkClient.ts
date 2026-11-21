import type { BookmarkApi } from "../bookmarkApi";
import { hc } from "hono/client";

const bookmarkClient = hc<BookmarkApi>("/");

export { bookmarkClient };
