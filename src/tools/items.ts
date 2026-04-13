import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { QuickBooksClient } from "../api/client.js";
import type { Item } from "../api/types.js";
import { toolResult, toolError } from "./index.js";

export function registerItemTools(server: McpServer, client: QuickBooksClient): void {
  server.tool(
    "qbo_list_items",
    "Search or list items (products/services) in QuickBooks Online.",
    {
      query: z.string().optional().describe("Optional WHERE clause, e.g. Name LIKE '%Widget%'"),
      maxResults: z.number().int().min(1).max(100).default(25).describe("Max results to return"),
    },
    async ({ query, maxResults }) => {
      try {
        const items = await client.query<Item>("Item", query, maxResults);
        return toolResult(items);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "qbo_get_item",
    "Get a single item by ID.",
    {
      itemId: z.string().regex(/^\d+$/, "Must be a numeric ID").describe("QuickBooks Item ID"),
    },
    async ({ itemId }) => {
      try {
        const item = await client.read<Item>("Item", itemId);
        return toolResult(item);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "qbo_create_item",
    "Create a new item (product or service) in QuickBooks Online.",
    {
      name: z.string().describe("Item name"),
      type: z.enum(["Inventory", "NonInventory", "Service"]).default("Service").describe("Item type"),
      unitPrice: z.number().optional().describe("Unit price"),
      incomeAccountRef: z.string().regex(/^\d+$/, "Must be a numeric ID").optional().describe("Income account ID"),
      expenseAccountRef: z.string().regex(/^\d+$/, "Must be a numeric ID").optional().describe("Expense account ID"),
    },
    async ({ name, type, unitPrice, incomeAccountRef, expenseAccountRef }) => {
      try {
        const body: Partial<Item> = { Name: name, Type: type };
        if (unitPrice !== undefined) body.UnitPrice = unitPrice;
        if (incomeAccountRef) body.IncomeAccountRef = { value: incomeAccountRef };
        if (expenseAccountRef) body.ExpenseAccountRef = { value: expenseAccountRef };

        const item = await client.create<Item>("Item", body);
        return toolResult(item);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "qbo_update_item",
    "Update an existing item. Requires the current SyncToken (from a get/list call).",
    {
      itemId: z.string().regex(/^\d+$/, "Must be a numeric ID").describe("QuickBooks Item ID"),
      syncToken: z.string().regex(/^\d+$/, "Must be numeric").describe("Current SyncToken for optimistic locking"),
      name: z.string().optional().describe("Item name"),
      unitPrice: z.number().optional().describe("Unit price"),
      type: z.enum(["Inventory", "NonInventory", "Service"]).optional().describe("Item type"),
    },
    async ({ itemId, syncToken, name, unitPrice, type }) => {
      try {
        const body: Record<string, unknown> = {
          Id: itemId,
          SyncToken: syncToken,
          sparse: true,
        };
        if (name) body.Name = name;
        if (unitPrice !== undefined) body.UnitPrice = unitPrice;
        if (type) body.Type = type;

        const item = await client.update<Item>("Item", body);
        return toolResult(item);
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
