import { describe, it, expect } from "vitest";
import { registerCompanyTools } from "../../src/tools/company.js";
import { createMockServer, createMockClient } from "./helpers.js";

describe("company tools", () => {
  it("registers qbo_get_company_info tool", () => {
    const { server, tools } = createMockServer();
    const client = createMockClient();
    registerCompanyTools(server, client);

    expect(tools.has("qbo_get_company_info")).toBe(true);
    expect(tools.get("qbo_get_company_info")!.description).toContain("company information");
  });

  it("handler calls client.getCompanyInfo() and returns result", async () => {
    const { server, tools } = createMockServer();
    const client = createMockClient();
    const companyInfo = { CompanyName: "Test Corp", LegalName: "Test Corp LLC" };
    client.getCompanyInfo.mockResolvedValue(companyInfo);

    registerCompanyTools(server, client);
    const result = await tools.get("qbo_get_company_info")!.handler({});

    expect(client.getCompanyInfo).toHaveBeenCalledOnce();
    expect(JSON.parse(result.content[0].text)).toEqual(companyInfo);
    expect(result.isError).toBeUndefined();
  });

  it("handler returns error on failure", async () => {
    const { server, tools } = createMockServer();
    const client = createMockClient();
    client.getCompanyInfo.mockRejectedValue(new Error("connection failed"));

    registerCompanyTools(server, client);
    const result = await tools.get("qbo_get_company_info")!.handler({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("connection failed");
  });
});
