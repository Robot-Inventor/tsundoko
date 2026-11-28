import { type AuthInfo, McpServer, createMcpHandler } from "@modelcontextprotocol/server";
import {
    addBookmark,
    addBookmarkInput,
    archiveBookmarkInput,
    bookmarkIdInput,
    editBookmark,
    getBookmark,
    listTagsForTool,
    removeBookmark,
    searchBookmarks,
    searchInput,
    setArchived,
    updateBookmarkInput
} from "./tools";
import { hasTokenPermission, scopesToPermissions } from "../lib/tokenPermissions";
import packageInfo from "../../package.json";
import { type } from "arktype";

// oxlint-disable-next-line max-statements, max-lines-per-function -- Registering seven tools is one linear wiring step.
const createServer = ({ authInfo }: { authInfo?: AuthInfo }): McpServer => {
    const server = new McpServer({ name: "tsundoko", version: packageInfo.version });
    const userId = authInfo?.clientId;
    const permissions = scopesToPermissions(authInfo?.scopes ?? []);

    if (!userId) {
        return server;
    }

    const searchTool = server.registerTool(
        "search_bookmarks",
        {
            annotations: {
                readOnlyHint: true
            },
            description:
                "Search the user's saved bookmarks by keyword and semantic similarity. Returns title, URL, description, tags, and dates. Use offset with limit to page through results.",
            inputSchema: searchInput
        },
        async (input) => searchBookmarks(userId, input)
    );

    const getTool = server.registerTool(
        "get_bookmark",
        {
            annotations: {
                readOnlyHint: true
            },
            description:
                "Fetch one saved bookmark by id, including the extracted article body as Markdown. Long articles are truncated.",
            inputSchema: bookmarkIdInput
        },
        async ({ id }) => getBookmark(userId, id)
    );

    const tagsTool = server.registerTool(
        "list_tags",
        {
            annotations: {
                readOnlyHint: true
            },
            description: "List the user's tags with their bookmark counts and colors.",
            inputSchema: type({})
        },
        async () => listTagsForTool(userId)
    );

    const addTool = server.registerTool(
        "add_bookmark",
        {
            description:
                "Save a URL as a bookmark. The server fetches the page title, description, and thumbnail, so this may take a few seconds.",
            inputSchema: addBookmarkInput
        },
        async (input) => addBookmark(userId, input)
    );

    const updateTool = server.registerTool(
        "update_bookmark",
        {
            description: "Update a bookmark's title and/or tags. Providing tags replaces the full tag list.",
            inputSchema: updateBookmarkInput
        },
        async (input) => editBookmark(userId, input)
    );

    const archiveTool = server.registerTool(
        "archive_bookmark",
        {
            description: "Archive a bookmark, or restore it from the archive when archived is false.",
            inputSchema: archiveBookmarkInput
        },
        async ({ archived, id }) => setArchived(userId, id, archived)
    );

    const deleteTool = server.registerTool(
        "delete_bookmark",
        {
            annotations: {
                destructiveHint: true
            },
            description: "Permanently delete a bookmark. This cannot be undone.",
            inputSchema: bookmarkIdInput
        },
        async ({ id }) => removeBookmark(userId, id)
    );

    if (!hasTokenPermission(permissions, "read")) {
        searchTool.disable();
        getTool.disable();
        tagsTool.disable();
    }

    if (!hasTokenPermission(permissions, "write")) {
        addTool.disable();
        updateTool.disable();
        archiveTool.disable();
    }

    if (!hasTokenPermission(permissions, "delete")) {
        deleteTool.disable();
    }

    return server;
};

const mcpHandler = createMcpHandler(createServer);

export { mcpHandler };
