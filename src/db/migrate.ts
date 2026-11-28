import { db } from "./index";
import { migrate } from "drizzle-orm/postgres-js/migrator";

// The `drizzle/` folder configured by `out` in drizzle.config.ts ships with the deployment, and the
// server starts from the repository root, so the relative path resolves there.
const runMigrations = async (): Promise<void> => {
    await migrate(db, { migrationsFolder: "drizzle" });
};

export { runMigrations };
