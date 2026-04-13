import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { QuickBooksClient } from "../api/client.js";
import type { Estimate, InvoiceLine } from "../api/types.js";
import { toolResult, toolError } from "./index.js";

const lineItemSchema = z.object({
  itemRef: z.string().regex(/^\d+$/, "Must be a numeric ID").describe("Item ID"),
  amount: z.number().describe("Line total amount"),
  quantity: z.number().optional().default(1).describe("Quantity"),
  unitPrice: z.number().optional().describe("Price per unit"),
});

export function registerEstimateTools(server: McpServer, client: QuickBooksClient): void {
  server.tool(
    "qbo_list_estimates",
    "Search or list estimates (quotes) in QuickBooks Online.",
    {
      query: z.string().optional().describe("Optional WHERE clause, e.g. TxnStatus = 'Pending'"),
      maxResults: z.number().int().min(1).max(100).default(25).describe("Max results to return"),
    },
    async ({ query, maxResults }) => {
      try {
        const estimates = await client.query<Estimate>("Estimate", query, maxResults);
        return toolResult(estimates);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "qbo_get_estimate",
    "Get a single estimate by ID.",
    {
      estimateId: z.string().regex(/^\d+$/, "Must be a numeric ID").describe("QuickBooks Estimate ID"),
    },
    async ({ estimateId }) => {
      try {
        const estimate = await client.read<Estimate>("Estimate", estimateId);
        return toolResult(estimate);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "qbo_create_estimate",
    "Create a new estimate (quote) with line items.",
    {
      customerRef: z.string().regex(/^\d+$/, "Must be a numeric ID").describe("Customer ID"),
      lineItems: z.array(lineItemSchema).min(1).describe("Estimate line items"),
      expirationDate: z.string().optional().describe("Expiration date (YYYY-MM-DD)"),
      txnDate: z.string().optional().describe("Transaction date (YYYY-MM-DD)"),
    },
    async ({ customerRef, lineItems, expirationDate, txnDate }) => {
      try {
        const lines: InvoiceLine[] = lineItems.map((li) => ({
          Amount: li.amount,
          DetailType: "SalesItemLineDetail" as const,
          SalesItemLineDetail: {
            ItemRef: { value: li.itemRef },
            Qty: li.quantity,
            UnitPrice: li.unitPrice,
          },
        }));

        const body: Partial<Estimate> = {
          CustomerRef: { value: customerRef },
          Line: lines,
        };
        if (expirationDate) body.ExpirationDate = expirationDate;
        if (txnDate) body.TxnDate = txnDate;

        const estimate = await client.create<Estimate>("Estimate", body);
        return toolResult(estimate);
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
