import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { QuickBooksClient } from "../api/client.js";
import type { Payment } from "../api/types.js";
import { toolResult, toolError } from "./index.js";

export function registerPaymentTools(server: McpServer, client: QuickBooksClient): void {
  server.tool(
    "qbo_list_payments",
    "Search or list payments in QuickBooks Online.",
    {
      query: z.string().optional().describe("Optional WHERE clause, e.g. CustomerRef = '123'"),
      maxResults: z.number().int().min(1).max(100).default(25).describe("Max results to return"),
    },
    async ({ query, maxResults }) => {
      try {
        const payments = await client.query<Payment>("Payment", query, maxResults);
        return toolResult(payments);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "qbo_get_payment",
    "Get a single payment by ID.",
    {
      paymentId: z.string().regex(/^\d+$/, "Must be a numeric ID").describe("QuickBooks Payment ID"),
    },
    async ({ paymentId }) => {
      try {
        const payment = await client.read<Payment>("Payment", paymentId);
        return toolResult(payment);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "qbo_create_payment",
    "Record a payment, optionally applied against an invoice.",
    {
      customerRef: z.string().regex(/^\d+$/, "Must be a numeric ID").describe("Customer ID"),
      totalAmount: z.number().describe("Payment amount"),
      invoiceId: z.string().regex(/^\d+$/, "Must be a numeric ID").optional().describe("Invoice ID to apply payment to"),
      paymentDate: z.string().optional().describe("Payment date (YYYY-MM-DD)"),
    },
    async ({ customerRef, totalAmount, invoiceId, paymentDate }) => {
      try {
        const body: Partial<Payment> = {
          CustomerRef: { value: customerRef },
          TotalAmt: totalAmount,
        };
        if (paymentDate) body.TxnDate = paymentDate;
        if (invoiceId) {
          body.Line = [
            {
              Amount: totalAmount,
              LinkedTxn: [{ TxnId: invoiceId, TxnType: "Invoice" }],
            },
          ];
        }

        const payment = await client.create<Payment>("Payment", body);
        return toolResult(payment);
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
