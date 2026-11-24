import { describe, expect, it } from "vitest";
import { createSemaphore } from "./outboundLimit";

const maxConcurrent = 2;
const taskCount = 4;
const taskDurationMs = 10;
const slot = 1;

describe("outbound semaphore", () => {
    it("never runs more tasks at once than the limit", async () => {
        const run = createSemaphore(maxConcurrent);
        let active = 0;
        let peak = 0;

        const task = async (): Promise<void> => {
            active += slot;
            peak = Math.max(peak, active);

            await new Promise((resolve) => {
                setTimeout(resolve, taskDurationMs);
            });

            active -= slot;
        };

        await Promise.all(Array.from({ length: taskCount }, () => run(task)));

        expect(peak).toBe(maxConcurrent);
    });
});
