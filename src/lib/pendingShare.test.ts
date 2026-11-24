import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { savePendingShare, takePendingShare } from "./pendingShare";

const store = new Map<string, string>();

const storage = {
    getItem: (key: string): string | null => store.get(key) ?? null,
    removeItem: (key: string): void => {
        store.delete(key);
    },
    setItem: (key: string, value: string): void => {
        store.set(key, value);
    }
} as const;

beforeEach(() => {
    store.clear();
    vi.stubGlobal("sessionStorage", storage);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("pending share", () => {
    it("keeps the confirmation flag across the sign-in handoff", () => {
        savePendingShare({
            content: {
                url: "https://example.com/article"
            },
            requiresConfirmation: true
        });

        expect(takePendingShare()).toEqual({
            content: {
                url: "https://example.com/article"
            },
            requiresConfirmation: true
        });

        expect(takePendingShare()).toBeNull();
    });
});
