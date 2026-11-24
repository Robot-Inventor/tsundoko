import { useEffect, useState } from "react";

const noDelayMs = 0;

// Re-renders once when the window closes, so the buttons disable without waiting for a server round
// trip. The server still enforces the deadline; this only keeps the UI from inviting a rejected call.
const usePasskeyEditingAllowed = (deadlineIso: string): boolean => {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const remaining = Date.parse(deadlineIso) - Date.now();
        const timer = setTimeout(
            () => {
                setNow(Date.now());
            },
            Math.max(remaining, noDelayMs)
        );

        return (): void => {
            clearTimeout(timer);
        };
    }, [deadlineIso]);

    return now < Date.parse(deadlineIso);
};

export { usePasskeyEditingAllowed };
