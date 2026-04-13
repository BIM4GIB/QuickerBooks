import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { QuickBooksClient } from "./api/client.js";
import { registerAllTools } from "./tools/index.js";
import { loadCredentials } from "./auth/credentials.js";

// Try credentials file first (written by `setup`), fall back to env vars
const creds = await loadCredentials();
const clientId = process.env.QBO_CLIENT_ID || creds?.clientId;
const clientSecret = process.env.QBO_CLIENT_SECRET || creds?.clientSecret;

if (creds?.sandbox && !process.env.QBO_SANDBOX) {
  process.env.QBO_SANDBOX = "true";
}

if (!clientId || !clientSecret) {
  console.error("No QuickBooks credentials found.");
  console.error("Run `node ~/.mcp-quickbooks/cli.mjs setup` to get started.");
  process.exit(1);
}

const server = new McpServer({
  name: "quickbooks-online",
  version: "0.1.0",
});

const qboClient = new QuickBooksClient(clientId, clientSecret);
registerAllTools(server, qboClient);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("QuickBooks MCP server running on stdio");
