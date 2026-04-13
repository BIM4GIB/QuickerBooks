import { describe, it, expect } from "vitest";
import { registerReportTools } from "../../src/tools/reports.js";
import { createMockServer, createMockClient } from "./helpers.js";

describe("report tools", () => {
  function setup() {
    const { server, tools } = createMockServer();
    const client = createMockClient();
    client.runReport = client.runReport || ((() => {}) as any);
    registerReportTools(server, client);
    return { tools, client };
  }

  it("registers 1 report tool", () => {
    const { tools } = setup();
    expect(tools.has("qbo_run_report")).toBe(true);
  });

  it("runs ProfitAndLoss report with date range", async () => {
    const { tools, client } = setup();
    const reportData = { Header: { ReportName: "ProfitAndLoss" }, Rows: [] };
    client.runReport.mockResolvedValue(reportData);

    const result = await tools.get("qbo_run_report")!.handler({
      reportName: "ProfitAndLoss",
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      accountingMethod: "Accrual",
    });

    expect(client.runReport).toHaveBeenCalledWith("ProfitAndLoss", {
      start_date: "2025-01-01",
      end_date: "2025-12-31",
      accounting_method: "Accrual",
    });
    expect(JSON.parse(result.content[0].text)).toEqual(reportData);
  });

  it("runs BalanceSheet report with no params", async () => {
    const { tools, client } = setup();
    client.runReport.mockResolvedValue({ Header: {} });

    await tools.get("qbo_run_report")!.handler({ reportName: "BalanceSheet" });

    expect(client.runReport).toHaveBeenCalledWith("BalanceSheet", {});
  });

  it("runs CashFlow report", async () => {
    const { tools, client } = setup();
    client.runReport.mockResolvedValue({});

    await tools.get("qbo_run_report")!.handler({ reportName: "CashFlow" });
    expect(client.runReport).toHaveBeenCalledWith("CashFlow", {});
  });

  it("returns error on failure", async () => {
    const { tools, client } = setup();
    client.runReport.mockRejectedValue(new Error("report failed"));

    const result = await tools.get("qbo_run_report")!.handler({ reportName: "ProfitAndLoss" });
    expect(result.isError).toBe(true);
  });
});
