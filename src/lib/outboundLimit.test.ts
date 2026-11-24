import { describe, expect, it } from "vitest";
import { runOutbound } from "./outboundLimit";

const maxConcurrentOutboundFetches = 8;
const maxConcurrentPerKey = 4;
const extraTasks = 4;
const taskDurationMs = 10;
const longerTaskDurationMs = 50;
const slot = 1;

const wait = async (durationMs: number): Promise<void> =>
    new Promise((resolve) => {
        setTimeout(resolve, durationMs);
    });

describe("outbound limit", () => {
    it("never runs more outbound tasks at once than the process limit", async () => {
        let active = 0;
        let peak = 0;

        const task = async (): Promise<void> => {
            active += slot;
            peak = Math.max(peak, active);

            await wait(taskDurationMs);

            active -= slot;
        };

        const totalTasks = maxConcurrentOutboundFetches + extraTasks;
        const running: Array<Promise<void>> = [];

        for (let index = 0; index < totalTasks; index += slot) {
            running.push(runOutbound(`user-${String(index)}`, task));
        }

        await Promise.all(running);

        expect(peak).toBe(maxConcurrentOutboundFetches);
    });

    it("releases the slot when the task throws", async () => {
        await expect(runOutbound("user-a", () => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
        await expect(runOutbound("user-a", () => Promise.resolve("ok"))).resolves.toBe("ok");
    });

    it("keeps one user from filling the pool while another user proceeds", async () => {
        const blockers = Array.from({ length: maxConcurrentPerKey }, () =>
            runOutbound("user-a", () => wait(longerTaskDurationMs))
        );

        let queuedStarted = false;
        const queued = runOutbound("user-a", () => {
            queuedStarted = true;

            return Promise.resolve("queued");
        });

        const other = runOutbound("user-b", () => Promise.resolve("other"));

        await expect(other).resolves.toBe("other");
        expect(queuedStarted).toBe(false);

        await Promise.all(blockers);
        await expect(queued).resolves.toBe("queued");
        expect(queuedStarted).toBe(true);
    });
});
