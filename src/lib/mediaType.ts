import { MIMEType } from "node:util";

const parseContentType = (value?: string | null): MIMEType | null => {
    if (!value) {
        return null;
    }

    try {
        return new MIMEType(value);
    } catch {
        return null;
    }
};

export { parseContentType };
