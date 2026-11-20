import { drizzle } from "drizzle-orm/postgres-js";
import { env } from "../env";
import postgres from "postgres";

const db = drizzle(postgres(env.DATABASE_URL));

export { db };
