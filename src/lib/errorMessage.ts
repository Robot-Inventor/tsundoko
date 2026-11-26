import { type ErrorCode, isErrorCode } from "./errorCodes";
import { t as translate } from "i18next";
import { type } from "arktype";

const apiErrorBody = type({
    error: {
        code: "string"
    }
});

const errorMessage = (code: ErrorCode): string => translate(`errors.${code}`);

const apiErrorMessage = (body: unknown, fallback: ErrorCode): string => {
    const parsed = apiErrorBody(body);

    return !(parsed instanceof type.errors) && isErrorCode(parsed.error.code)
        ? errorMessage(parsed.error.code)
        : errorMessage(fallback);
};

// Library-generated Better Auth errors keep their English message. Only codes this app owns are translated.
const authErrorMessage = (
    error: { code?: string | undefined; message?: string | undefined },
    fallback: ErrorCode
): string => {
    if (error.code && isErrorCode(error.code)) {
        return errorMessage(error.code);
    }

    return error.message?.length ? error.message : errorMessage(fallback);
};

export { apiErrorMessage, authErrorMessage, errorMessage };
