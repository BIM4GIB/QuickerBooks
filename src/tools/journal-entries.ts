import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { QuickBooksClient } from "../api/client.js";
import type { JournalEntry, JournalEntryLine } from "../api/types.js";
import { toolResult, toolError } from "./index.js";

const journalLineSchema = z.object({
  postingType: z.enum(["Debit", "Credit"]).describe("Debit or Credit"),
  accountRef: z.string().regex(/^\d+$/, "Must be a numeric ID").describe("Account ID"),
  amount: z.number().describe("Line amount"),
  description: z.string().optional().describe("Line memo/description"),
});

export function registerJournalEntryTools(server: McpServer, client: QuickBooksClient): void {
  server.tool(
    "qbo_list_journal_entries",
    "Search or list journal entries in QuickBooks Online.",
    {
      query: z.string().optional().describe("Optional WHERE clause"),
      maxResults: z.number().int().min(1).max(100).default(25).describe("Max results to return"),
    },
    async ({ query, maxResults }) => {
      try {
        const entries = await client.query<JournalEntry>("JournalEntry", query, maxResults);
        return toolResult(entries);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "qbo_get_journal_entry",
    "Get a single journal entry by ID.",
    {
      journalEntryId: z.string().regex(/^\d+$/, "Must be a numeric ID").describe("QuickBooks JournalEntry ID"),
    },
    async ({ journalEntryId }) => {
      try {
        const entry = await client.read<JournalEntry>("JournalEntry", journalEntryId);
        return toolResult(entry);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "qbo_create_journal_entry",
    "Create a new journal entry. Debits and credits must balance.",
    {
      lines: z.array(journalLineSchema).min(2).describe("Journal entry lines (debits and credits must balance)"),
      txnDate: z.string().optional().describe("Transaction date (YYYY-MM-DD)"),
    },
    async ({ lines, txnDate }) => {
      try {
        const entryLines: JournalEntryLine[] = lines.map((l) => ({
          Amount: l.amount,
          DetailType: "JournalEntryLineDetail" as const,
          JournalEntryLineDetail: {
            PostingType: l.postingType,
            AccountRef: { value: l.accountRef },
            Description: l.description,
          },
        }));

        const body: Partial<JournalEntry> = { Line: entryLines };
        if (txnDate) body.TxnDate = txnDate;

        const entry = await client.create<JournalEntry>("JournalEntry", body);
        return toolResult(entry);
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
