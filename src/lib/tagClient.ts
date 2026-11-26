import type { TagApi } from "../tagApi";
import { hc } from "hono/client";

const tagClient = hc<TagApi>("/");

export { tagClient };
