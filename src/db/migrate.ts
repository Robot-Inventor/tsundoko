/* oxlint-disable no-await-in-loop, react-doctor/async-await-in-loop -- Files are converted one at a time to keep memory flat. */
import { convertLegacyThumbnail, deleteLegacyThumbnail } from "../lib/imageCache";
import { eq, isNotNull } from "drizzle-orm";
import { bookmarks } from "./schema";
import { db } from "./index";
import { migrate } from "drizzle-orm/postgres-js/migrator";

// X renders used to be saved as PNG with their path in `thumbnailFile`. Now every thumbnail lives
// in the shared WebP cache, so each old file is converted and its column cleared exactly once.
// A failure stops startup; the applied SQL stays in place and a restart retries the file.
const migrateLegacyThumbnails = async (): Promise<void> => {
    const rows = await db
        .select({ id: bookmarks.id, thumbnailFile: bookmarks.thumbnailFile })
        .from(bookmarks)
        .where(isNotNull(bookmarks.thumbnailFile));

    for (const { id, thumbnailFile } of rows) {
        if (thumbnailFile) {
            await convertLegacyThumbnail(id, thumbnailFile);
            await db.update(bookmarks).set({ thumbnailFile: null }).where(eq(bookmarks.id, id));
            await deleteLegacyThumbnail(thumbnailFile);
        }
    }
};

// The `drizzle/` folder configured by `out` in drizzle.config.ts ships with the deployment, and the
// server starts from the repository root, so the relative path resolves there.
const runMigrations = async (): Promise<void> => {
    await migrate(db, { migrationsFolder: "drizzle" });
    await migrateLegacyThumbnails();
};

export { runMigrations };
