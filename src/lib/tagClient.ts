import type { TagApi } from "../tagApi";
import { authFetch } from "./authFetch";
import { hc } from "hono/client";

const tagClient = hc<TagApi>("/", { fetch: authFetch });

export { tagClient };
