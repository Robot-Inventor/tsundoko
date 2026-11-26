import type { ErrorCode } from "./errorCodes";
import type { MiddlewareHandler } from "hono";
import { apiError } from "./apiError";
import { bodyLimit } from "hono/body-limit";
import { httpStatus } from "./httpStatus";

const maxRequestBytes = 16_384;

const requestBodyLimit = (code: ErrorCode): MiddlewareHandler =>
    bodyLimit({
        maxSize: maxRequestBytes,
        onError: (context) => context.json(apiError(code), httpStatus.payloadTooLarge)
    });

export { requestBodyLimit };
