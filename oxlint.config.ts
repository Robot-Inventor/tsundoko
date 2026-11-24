import { oxlintReactConfig } from "@robot-inventor/oxlint-config";

export default {
    ...oxlintReactConfig,
    ignorePatterns: ["src/components/ui/**", "src/db/auth-schema.ts"]
};
