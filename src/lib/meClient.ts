import type { Account, AccountApi } from "../accountApi";
import { authFetch } from "./authFetch";
import { hc } from "hono/client";

const meClient = hc<AccountApi>("/", { fetch: authFetch });

export { type Account, meClient };
