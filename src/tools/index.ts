import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { QuickBooksClient } from "../api/client.js";
import { QuickBooksError, truncateResult } from "../api/client.js";
import { registerCompanyTools } from "./company.js";
import { registerCustomerTools } from "./customers.js";
import { registerInvoiceTools } from "./invoices.js";
import { registerPaymentTools } from "./payments.js";
import { registerVendorTools } from "./vendors.js";
import { registerItemTools } from "./items.js";
import { registerEstimateTools } from "./estimates.js";
import { registerBillTools } from "./bills.js";
import { registerJournalEntryTools } from "./journal-entries.js";
import { registerAccountTools } from "./accounts.js";
import { registerReportTools } from "./reports.js";

export function toolResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: truncateResult(data) }],
  };
}

export function toolError(err: unknown) {
  let message: string;

  if (err instanceof QuickBooksError) {
    // Only expose the status code and QBO fault message — no raw HTTP bodies or paths
    message = `QuickBooks API error (${err.statusCode}): ${err.message}`;
  } else if (err instanceof Error) {
    // Strip potential internal details (file paths, stack traces)
    if (err.message.includes("ENOENT") || err.message.includes("/")) {
      message = "An internal error occurred. Check server logs for details.";
    } else {
      message = err.message;
    }
    // Log full error to stderr for debugging (not visible to LLM)
    console.error("[tool error]", err);
  } else {
    message = "An unexpected error occurred.";
    console.error("[tool error]", err);
  }

  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

export function registerAllTools(server: McpServer, client: QuickBooksClient): void {
  registerCompanyTools(server, client);
  registerCustomerTools(server, client);
  registerInvoiceTools(server, client);
  registerPaymentTools(server, client);
  registerVendorTools(server, client);
  registerItemTools(server, client);
  registerEstimateTools(server, client);
  registerBillTools(server, client);
  registerJournalEntryTools(server, client);
  registerAccountTools(server, client);
  registerReportTools(server, client);
}
