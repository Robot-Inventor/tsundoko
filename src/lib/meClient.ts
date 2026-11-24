import type { Account, AccountApi } from "../accountApi";
import { hc } from "hono/client";

const meClient = hc<AccountApi>("/");

export { type Account, meClient };
