import type { ErrorCode } from "./errorCodes";

interface ApiErrorBody {
    error: {
        code: ErrorCode;
        params?: Record<string, string | number> | undefined;
    };
}

const apiError = (code: ErrorCode, params?: Record<string, string | number>): ApiErrorBody => ({
    error: {
        code,
        params
    }
});

export { apiError };
