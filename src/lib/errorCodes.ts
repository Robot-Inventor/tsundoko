import en from "../locales/en.json";

type ErrorKey = keyof typeof en;

type ErrorCodeOf<K> = K extends `errors.${infer Code}` ? Code : never;

type ErrorCode = ErrorCodeOf<ErrorKey>;

const errorPrefix = "errors.";

const errorCodes = new Set<string>(
    (Object.keys(en) as ErrorKey[])
        .filter((key) => key.startsWith(errorPrefix))
        .map((key) => key.slice(errorPrefix.length))
);

const isErrorCode = (value: string): value is ErrorCode => errorCodes.has(value);

export { type ErrorCode, isErrorCode };
