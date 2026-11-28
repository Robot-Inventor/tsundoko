import { clearAuthState } from "./authClient";
import { httpStatus } from "./httpStatus";

let onUnauthorized: (() => void) | null = null;

const setUnauthorizedHandler = (handler: () => void): void => {
    onUnauthorized = handler;
};

// A 401 means the cached signed-in flag is stale: the session expired or another tab signed out.
// Dropping the cache lets the route guards revalidate instead of keeping the user on a page whose
// requests all fail. The handler reruns those guards.
const authFetch: typeof fetch = async (input, init) => {
    const response = await fetch(input, init);

    if (response.status === httpStatus.unauthorized) {
        clearAuthState();
        onUnauthorized?.();
    }

    return response;
};

export { authFetch, setUnauthorizedHandler };
