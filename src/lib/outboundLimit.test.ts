import { describe, expect, it } from "vitest";
import { runOutbound, runOutboundFor } from "./outboundLimit";

const maxConcurrentOutboundFetches = 8;
const extraTasks = 4;
const taskDurationMs = 10;
const slot = 1;

const wait = async (): Promise<void> =>
    new Promise((resolve) => {
        setTimeout(resolve, taskDurationMs);
    });

describe("outbound limit", () => {
    it("never runs more outbound tasks at once than the process limit", async () => {
        let active = 0;
        let peak = 0;

        const task = async (): Promise<void> => {
            active += slot;
            peak = Math.max(peak, active);

            await wait();

            active -= slot;
        };

        await Promise.all(Array.from({ length: maxConcurrentOutboundFetches + extraTasks }, () => runOutbound(task)));

        expect(peak).toBeLessThanOrEqual(maxConcurrentOutboundFetches);
    });

    it("releases the slot when the task throws", async () => {
        await expect(runOutbound(() => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
        await expect(runOutbound(() => Promise.resolve("ok"))).resolves.toBe("ok");
    });

    it("rejects a second concurrent request from the same user", async () => {
        const first = runOutboundFor("user-a", wait);

        await expect(runOutboundFor("user-a", () => Promise.resolve("second"))).rejects.toThrow();
        await expect(runOutboundFor("user-b", () => Promise.resolve("other"))).resolves.toBe("other");
        await expect(first).resolves.toBeUndefined();
    });
});
