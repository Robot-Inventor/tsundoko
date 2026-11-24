import { describe, expect, it } from "vitest";
import { runOutbound } from "./outboundLimit";

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

        expect(peak).toBe(maxConcurrentOutboundFetches);
    });

    it("releases the slot when the task throws", async () => {
        await expect(runOutbound(() => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
        await expect(runOutbound(() => Promise.resolve("ok"))).resolves.toBe("ok");
    });
});
