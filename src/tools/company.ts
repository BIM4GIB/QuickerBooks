import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { QuickBooksClient } from "../api/client.js";
import { toolResult, toolError } from "./index.js";

export function registerCompanyTools(server: McpServer, client: QuickBooksClient): void {
  server.tool(
    "qbo_get_company_info",
    "Get company information for the connected QuickBooks Online account.",
    {},
    async () => {
      try {
        const info = await client.getCompanyInfo();
        return toolResult(info);
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
