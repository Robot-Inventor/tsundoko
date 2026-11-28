# AGENTS.md

- Use shadcn/ui components with the `style: "base-nova"` configuration, installed via `bunx shadcn add <item> --yes`.
- Since new components are frequently added to shadcn/ui, do not rely on memory to determine whether a specific component is available; instead, verify it by checking the documentation: https://ui.shadcn.com/llms.txt
- You may implement a custom component using Base UI only if an appropriate component is not available in shadcn/ui.
- Create a Changesets file that concisely describes the changes, following a style similar to Conventional Commits. You can learn how to create this file by running `bunx changeset -h`.
