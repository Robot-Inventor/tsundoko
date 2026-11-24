import { OutboundBusyError, runOutbound } from "./outboundLimit";
import { describe, expect, it } from "vitest";

const maxConcurrentOutboundFetches = 8;
const maxConcurrentPerKey = 4;
const taskDurationMs = 50;

const wait = async (): Promise<void> =>
    new Promise((resolve) => {
        setTimeout(resolve, taskDurationMs);
    });

const fillProcess = (): Array<Promise<void>> => {
    const running: Array<Promise<void>> = [];

    for (let index = 0; index < maxConcurrentOutboundFetches;) {
        // oxlint-disable-next-line no-magic-numbers -- Advancing the loop index by one is self-evident.
        index += 1;
        running.push(runOutbound(`user-${String(index)}`, wait));
    }

    return running;
};

describe("outbound limit", () => {
    it("admits up to the process limit and rejects the next request", async () => {
        const running = fillProcess();

        await expect(runOutbound("overflow", () => Promise.resolve("late"))).rejects.toBeInstanceOf(OutboundBusyError);

        await Promise.all(running);

        await expect(runOutbound("overflow", () => Promise.resolve("now"))).resolves.toBe("now");
    });

    it("keeps one user from filling the pool while another user proceeds", async () => {
        const blockers = Array.from({ length: maxConcurrentPerKey }, () => runOutbound("user-a", wait));

        await expect(runOutbound("user-a", () => Promise.resolve("fifth"))).rejects.toBeInstanceOf(OutboundBusyError);
        await expect(runOutbound("user-b", () => Promise.resolve("other"))).resolves.toBe("other");

        await Promise.all(blockers);
    });

    it("releases the slot when the task throws", async () => {
        await expect(runOutbound("user-a", () => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
        await expect(runOutbound("user-a", () => Promise.resolve("ok"))).resolves.toBe("ok");
    });
});
