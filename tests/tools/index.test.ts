import { describe, it, expect, vi } from "vitest";
import { toolResult, toolError, registerAllTools } from "../../src/tools/index.js";
import { QuickBooksError } from "../../src/api/client.js";
import { createMockServer, createMockClient } from "./helpers.js";

describe("toolResult", () => {
  it("returns text content with JSON-stringified data", () => {
    const data = { Id: "1", Name: "Test" };
    const result = toolResult(data);
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual(data);
  });

  it("does not set isError", () => {
    const result = toolResult({});
    expect(result).not.toHaveProperty("isError");
  });

  it("handles arrays", () => {
    const result = toolResult([1, 2, 3]);
    expect(JSON.parse(result.content[0].text)).toEqual([1, 2, 3]);
  });

  it("handles null", () => {
    const result = toolResult(null);
    expect(result.content[0].text).toBe("null");
  });
});

describe("toolError", () => {
  it("formats QuickBooksError with status code", () => {
    const err = new QuickBooksError("Business Validation Error", 400);
    const result = toolError(err);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("400");
    expect(result.content[0].text).toContain("Business Validation Error");
  });

  it("sanitizes errors containing file paths", () => {
    const err = new Error("ENOENT: no such file /home/user/.mcp-quickbooks/tokens.json");
    const result = toolError(err);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("An internal error occurred. Check server logs for details.");
  });

  it("sanitizes errors containing forward slashes", () => {
    const err = new Error("Failed reading /etc/secret");
    const result = toolError(err);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("An internal error occurred. Check server logs for details.");
  });

  it("passes through safe error messages", () => {
    const err = new Error("Invalid input");
    const result = toolError(err);
    expect(result.content[0].text).toBe("Invalid input");
  });

  it("handles non-Error objects", () => {
    const result = toolError("string error");
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("An unexpected error occurred.");
  });

  it("handles null/undefined errors", () => {
    const result = toolError(null);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("An unexpected error occurred.");
  });

  it("logs errors to stderr", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("logged error");
    toolError(err);
    expect(spy).toHaveBeenCalledWith("[tool error]", err);
  });

  it("does not log QuickBooksError to stderr", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new QuickBooksError("api error", 400);
    toolError(err);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("registerAllTools", () => {
  it("registers all 32 tools across 11 entities", () => {
    const { server, tools } = createMockServer();
    const client = createMockClient();

    registerAllTools(server, client);

    // 1 company + 4 customer + 4 invoice + 3 payment + 4 vendor + 4 item
    // + 3 estimate + 3 bill + 3 journal entry + 2 account + 1 report = 32
    expect(server.tool).toHaveBeenCalledTimes(32);

    const names = [...tools.keys()];
    // Original entities
    expect(names).toContain("qbo_get_company_info");
    expect(names).toContain("qbo_list_customers");
    expect(names).toContain("qbo_create_invoice");
    expect(names).toContain("qbo_send_invoice");
    expect(names).toContain("qbo_create_payment");
    expect(names).toContain("qbo_update_vendor");
    expect(names).toContain("qbo_update_item");
    // New entities
    expect(names).toContain("qbo_list_estimates");
    expect(names).toContain("qbo_get_estimate");
    expect(names).toContain("qbo_create_estimate");
    expect(names).toContain("qbo_list_bills");
    expect(names).toContain("qbo_get_bill");
    expect(names).toContain("qbo_create_bill");
    expect(names).toContain("qbo_list_journal_entries");
    expect(names).toContain("qbo_get_journal_entry");
    expect(names).toContain("qbo_create_journal_entry");
    expect(names).toContain("qbo_list_accounts");
    expect(names).toContain("qbo_get_account");
    expect(names).toContain("qbo_run_report");
  });
});
