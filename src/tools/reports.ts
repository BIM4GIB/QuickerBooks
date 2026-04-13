import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { QuickBooksClient } from "../api/client.js";
import { toolResult, toolError } from "./index.js";

const VALID_REPORTS = new Set([
  "ProfitAndLoss",
  "BalanceSheet",
  "CashFlow",
  "TrialBalance",
  "GeneralLedger",
  "AgedReceivables",
  "AgedPayables",
  "CustomerIncome",
  "VendorExpenses",
]);

export function registerReportTools(server: McpServer, client: QuickBooksClient): void {
  server.tool(
    "qbo_run_report",
    "Run a financial report. Available reports: ProfitAndLoss, BalanceSheet, CashFlow, TrialBalance, GeneralLedger, AgedReceivables, AgedPayables, CustomerIncome, VendorExpenses.",
    {
      reportName: z
        .enum([...VALID_REPORTS] as [string, ...string[]])
        .describe("Report name"),
      startDate: z.string().optional().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().optional().describe("End date (YYYY-MM-DD)"),
      accountingMethod: z
        .enum(["Accrual", "Cash"])
        .optional()
        .describe("Accrual or Cash basis"),
    },
    async ({ reportName, startDate, endDate, accountingMethod }) => {
      try {
        const params: Record<string, string> = {};
        if (startDate) params.start_date = startDate;
        if (endDate) params.end_date = endDate;
        if (accountingMethod) params.accounting_method = accountingMethod;

        const report = await client.runReport(reportName, params);
        return toolResult(report);
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
