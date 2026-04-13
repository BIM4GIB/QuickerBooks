import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { QuickBooksClient } from "../api/client.js";
import type { Bill, BillLine } from "../api/types.js";
import { toolResult, toolError } from "./index.js";

const billLineSchema = z.object({
  accountRef: z.string().regex(/^\d+$/, "Must be a numeric ID").describe("Expense account ID"),
  amount: z.number().describe("Line amount"),
  description: z.string().optional().describe("Line description"),
});

export function registerBillTools(server: McpServer, client: QuickBooksClient): void {
  server.tool(
    "qbo_list_bills",
    "Search or list bills (payables) in QuickBooks Online.",
    {
      query: z.string().optional().describe("Optional WHERE clause, e.g. VendorRef = '42'"),
      maxResults: z.number().int().min(1).max(100).default(25).describe("Max results to return"),
    },
    async ({ query, maxResults }) => {
      try {
        const bills = await client.query<Bill>("Bill", query, maxResults);
        return toolResult(bills);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "qbo_get_bill",
    "Get a single bill by ID.",
    {
      billId: z.string().regex(/^\d+$/, "Must be a numeric ID").describe("QuickBooks Bill ID"),
    },
    async ({ billId }) => {
      try {
        const bill = await client.read<Bill>("Bill", billId);
        return toolResult(bill);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "qbo_create_bill",
    "Create a new bill (vendor payable) with line items.",
    {
      vendorRef: z.string().regex(/^\d+$/, "Must be a numeric ID").describe("Vendor ID"),
      lineItems: z.array(billLineSchema).min(1).describe("Bill line items"),
      dueDate: z.string().optional().describe("Due date (YYYY-MM-DD)"),
      txnDate: z.string().optional().describe("Transaction date (YYYY-MM-DD)"),
    },
    async ({ vendorRef, lineItems, dueDate, txnDate }) => {
      try {
        const lines: BillLine[] = lineItems.map((li) => ({
          Amount: li.amount,
          DetailType: "AccountBasedExpenseLineDetail" as const,
          AccountBasedExpenseLineDetail: {
            AccountRef: { value: li.accountRef },
          },
        }));

        const body: Partial<Bill> = {
          VendorRef: { value: vendorRef },
          Line: lines,
        };
        if (dueDate) body.DueDate = dueDate;
        if (txnDate) body.TxnDate = txnDate;

        const bill = await client.create<Bill>("Bill", body);
        return toolResult(bill);
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
