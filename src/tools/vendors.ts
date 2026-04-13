import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { QuickBooksClient } from "../api/client.js";
import type { Vendor } from "../api/types.js";
import { toolResult, toolError } from "./index.js";

export function registerVendorTools(server: McpServer, client: QuickBooksClient): void {
  server.tool(
    "qbo_list_vendors",
    "Search or list vendors in QuickBooks Online.",
    {
      query: z.string().optional().describe("Optional WHERE clause, e.g. DisplayName LIKE '%Acme%'"),
      maxResults: z.number().int().min(1).max(100).default(25).describe("Max results to return"),
    },
    async ({ query, maxResults }) => {
      try {
        const vendors = await client.query<Vendor>("Vendor", query, maxResults);
        return toolResult(vendors);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "qbo_get_vendor",
    "Get a single vendor by ID.",
    {
      vendorId: z.string().regex(/^\d+$/, "Must be a numeric ID").describe("QuickBooks Vendor ID"),
    },
    async ({ vendorId }) => {
      try {
        const vendor = await client.read<Vendor>("Vendor", vendorId);
        return toolResult(vendor);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "qbo_create_vendor",
    "Create a new vendor in QuickBooks Online.",
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
        const body: Partial<Vendor> = { DisplayName: displayName };
        if (email) body.PrimaryEmailAddr = { Address: email };
        if (phone) body.PrimaryPhone = { FreeFormNumber: phone };
        if (companyName) body.CompanyName = companyName;
        if (givenName) body.GivenName = givenName;
        if (familyName) body.FamilyName = familyName;

        const vendor = await client.create<Vendor>("Vendor", body);
        return toolResult(vendor);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "qbo_update_vendor",
    "Update an existing vendor. Requires the current SyncToken (from a get/list call).",
    {
      vendorId: z.string().regex(/^\d+$/, "Must be a numeric ID").describe("QuickBooks Vendor ID"),
      syncToken: z.string().regex(/^\d+$/, "Must be numeric").describe("Current SyncToken for optimistic locking"),
      displayName: z.string().optional().describe("Display name"),
      email: z.string().email().optional().describe("Primary email address"),
      phone: z.string().optional().describe("Primary phone number"),
      companyName: z.string().optional().describe("Company name"),
    },
    async ({ vendorId, syncToken, displayName, email, phone, companyName }) => {
      try {
        const body: Record<string, unknown> = {
          Id: vendorId,
          SyncToken: syncToken,
          sparse: true,
        };
        if (displayName) body.DisplayName = displayName;
        if (email) body.PrimaryEmailAddr = { Address: email };
        if (phone) body.PrimaryPhone = { FreeFormNumber: phone };
        if (companyName) body.CompanyName = companyName;

        const vendor = await client.update<Vendor>("Vendor", body);
        return toolResult(vendor);
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
