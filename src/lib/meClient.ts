import type { Account, MeApi } from "../meApi";
import { hc } from "hono/client";

const meClient = hc<MeApi>("/");

export { type Account, meClient };
