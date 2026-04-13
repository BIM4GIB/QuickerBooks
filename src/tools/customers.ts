import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { QuickBooksClient } from "../api/client.js";
import type { Customer } from "../api/types.js";
import { toolResult, toolError } from "./index.js";

export function registerCustomerTools(server: McpServer, client: QuickBooksClient): void {
  server.tool(
    "qbo_list_customers",
    "Search or list customers in QuickBooks Online.",
    {
      query: z.string().optional().describe("Optional WHERE clause, e.g. DisplayName LIKE '%Smith%'"),
      maxResults: z.number().int().min(1).max(100).default(25).describe("Max results to return"),
    },
    async ({ query, maxResults }) => {
      try {
        const customers = await client.query<Customer>("Customer", query, maxResults);
        return toolResult(customers);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "qbo_get_customer",
    "Get a single customer by ID.",
    {
      customerId: z.string().regex(/^\d+$/, "Must be a numeric ID").describe("QuickBooks Customer ID"),
    },
    async ({ customerId }) => {
      try {
        const customer = await client.read<Customer>("Customer", customerId);
        return toolResult(customer);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "qbo_create_customer",
    "Create a new customer in QuickBooks Online.",
    {
      displayName: z.string().describe("Display name (must be unique)"),
      email: z.string().email().optional().describe("Primary email address"),
      phone: z.string().optional().describe("Primary phone number"),
      companyName: z.string().optional().describe("Company name"),
      givenName: z.string().optional().describe("First name"),
      familyName: z.string().optional().describe("Last name"),
    },
    async ({ displayName, email, phone, companyName, givenName, familyName }) => {
      try {
        const body: Partial<Customer> = { DisplayName: displayName };
        if (email) body.PrimaryEmailAddr = { Address: email };
        if (phone) body.PrimaryPhone = { FreeFormNumber: phone };
        if (companyName) body.CompanyName = companyName;
        if (givenName) body.GivenName = givenName;
        if (familyName) body.FamilyName = familyName;

        const customer = await client.create<Customer>("Customer", body);
        return toolResult(customer);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "qbo_update_customer",
    "Update an existing customer. Requires the current SyncToken (from a get/list call).",
    {
      customerId: z.string().regex(/^\d+$/, "Must be a numeric ID").describe("QuickBooks Customer ID"),
      syncToken: z.string().regex(/^\d+$/, "Must be numeric").describe("Current SyncToken for optimistic locking"),
      displayName: z.string().optional().describe("Display name"),
      email: z.string().email().optional().describe("Primary email address"),
      phone: z.string().optional().describe("Primary phone number"),
      companyName: z.string().optional().describe("Company name"),
    },
    async ({ customerId, syncToken, displayName, email, phone, companyName }) => {
      try {
        const body: Record<string, unknown> = {
          Id: customerId,
          SyncToken: syncToken,
          sparse: true,
        };
        if (displayName) body.DisplayName = displayName;
        if (email) body.PrimaryEmailAddr = { Address: email };
        if (phone) body.PrimaryPhone = { FreeFormNumber: phone };
        if (companyName) body.CompanyName = companyName;

        const customer = await client.update<Customer>("Customer", body);
        return toolResult(customer);
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
