import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { QuickBooksClient } from "../api/client.js";
import type { Account } from "../api/types.js";
import { toolResult, toolError } from "./index.js";

export function registerAccountTools(server: McpServer, client: QuickBooksClient): void {
  server.tool(
    "qbo_list_accounts",
    "Search or list accounts in the Chart of Accounts.",
    {
      query: z.string().optional().describe("Optional WHERE clause, e.g. AccountType = 'Expense'"),
      maxResults: z.number().int().min(1).max(100).default(100).describe("Max results to return"),
    },
    async ({ query, maxResults }) => {
      try {
        const accounts = await client.query<Account>("Account", query, maxResults);
        return toolResult(accounts);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "qbo_get_account",
    "Get a single account by ID.",
    {
      accountId: z.string().regex(/^\d+$/, "Must be a numeric ID").describe("QuickBooks Account ID"),
    },
    async ({ accountId }) => {
      try {
        const account = await client.read<Account>("Account", accountId);
        return toolResult(account);
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
