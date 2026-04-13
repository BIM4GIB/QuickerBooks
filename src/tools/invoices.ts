import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { QuickBooksClient } from "../api/client.js";
import type { Invoice, InvoiceLine } from "../api/types.js";
import { toolResult, toolError } from "./index.js";

const lineItemSchema = z.object({
  itemRef: z.string().regex(/^\d+$/, "Must be a numeric ID").describe("Item ID"),
  amount: z.number().describe("Line total amount"),
  quantity: z.number().optional().default(1).describe("Quantity"),
  unitPrice: z.number().optional().describe("Price per unit"),
});

export function registerInvoiceTools(server: McpServer, client: QuickBooksClient): void {
  server.tool(
    "qbo_list_invoices",
    "Search or list invoices in QuickBooks Online.",
    {
      query: z.string().optional().describe("Optional WHERE clause, e.g. CustomerRef = '123'"),
      maxResults: z.number().int().min(1).max(100).default(25).describe("Max results to return"),
    },
    async ({ query, maxResults }) => {
      try {
        const invoices = await client.query<Invoice>("Invoice", query, maxResults);
        return toolResult(invoices);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "qbo_get_invoice",
    "Get a single invoice by ID.",
    {
      invoiceId: z.string().regex(/^\d+$/, "Must be a numeric ID").describe("QuickBooks Invoice ID"),
    },
    async ({ invoiceId }) => {
      try {
        const invoice = await client.read<Invoice>("Invoice", invoiceId);
        return toolResult(invoice);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "qbo_create_invoice",
    "Create a new invoice with line items.",
    {
      customerRef: z.string().regex(/^\d+$/, "Must be a numeric ID").describe("Customer ID"),
      lineItems: z.array(lineItemSchema).min(1).describe("Invoice line items"),
      dueDate: z.string().optional().describe("Due date (YYYY-MM-DD)"),
      txnDate: z.string().optional().describe("Transaction date (YYYY-MM-DD)"),
    },
    async ({ customerRef, lineItems, dueDate, txnDate }) => {
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

        const body: Partial<Invoice> = {
          CustomerRef: { value: customerRef },
          Line: lines,
        };
        if (dueDate) body.DueDate = dueDate;
        if (txnDate) body.TxnDate = txnDate;

        const invoice = await client.create<Invoice>("Invoice", body);
        return toolResult(invoice);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "qbo_send_invoice",
    "Send an invoice by email to the customer.",
    {
      invoiceId: z.string().regex(/^\d+$/, "Must be a numeric ID").describe("QuickBooks Invoice ID"),
      email: z.string().email().optional().describe("Override recipient email (defaults to customer email on file)"),
    },
    async ({ invoiceId, email }) => {
      try {
        await client.sendInvoice(invoiceId, email);
        return toolResult({ success: true, message: `Invoice ${invoiceId} sent.` });
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
