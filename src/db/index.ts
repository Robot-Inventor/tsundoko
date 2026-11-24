import { drizzle } from "drizzle-orm/postgres-js";
import { env } from "../env";
import postgres from "postgres";

const client = postgres(env.DATABASE_URL);
const db = drizzle(client);

export { client, db };
