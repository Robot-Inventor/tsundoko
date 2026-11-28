import { RateLimiterRes, createGate } from "./outboundLimit";
import { describe, expect, it } from "vitest";

const twoSlots = 2;
const oneSlot = 1;

interface Deferred<T> {
    promise: Promise<T>;
    resolve: (value: T) => void;
}

const deferred = <T>(): Deferred<T> => {
    let resolve: (value: T) => void = (): null => null;
    const promise = new Promise<T>((done) => {
        resolve = done;
    });

    return {
        promise,
        resolve
    };
};

const holdSlot = async (
    gate: <T>(key: string, task: () => Promise<T>) => Promise<T>,
    key: string
): Promise<{ release: () => void; running: Promise<null> }> => {
    const started = deferred<null>();
    const release = deferred<null>();
    const running: Promise<null> = gate(key, async (): Promise<null> => {
        started.resolve(null);
        await release.promise;

        return null;
    });

    await started.promise;

    return {
        release: (): void => {
            release.resolve(null);
        },
        running
    };
};

describe("createGate", () => {
    it("rejects a task from the same key while its slot is held", async () => {
        const gate = createGate(twoSlots, oneSlot);
        const { release, running } = await holdSlot(gate, "user-a");

        await expect(gate("user-a", (): Promise<null> => Promise.resolve(null))).rejects.toBeInstanceOf(RateLimiterRes);

        release();
        await running;
    });

    it("admits another key while the global pool has room", async () => {
        const gate = createGate(twoSlots, oneSlot);
        const { release, running } = await holdSlot(gate, "user-a");

        await expect(gate("user-b", (): Promise<string> => Promise.resolve("ok"))).resolves.toBe("ok");

        release();
        await running;
    });

    it("rejects a task once the global pool is full", async () => {
        const gate = createGate(oneSlot, twoSlots);
        const { release, running } = await holdSlot(gate, "user-a");

        await expect(gate("user-b", (): Promise<null> => Promise.resolve(null))).rejects.toBeInstanceOf(RateLimiterRes);

        release();
        await running;
    });
});
