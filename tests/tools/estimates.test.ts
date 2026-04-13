import { describe, it, expect } from "vitest";
import { registerEstimateTools } from "../../src/tools/estimates.js";
import { createMockServer, createMockClient } from "./helpers.js";

describe("estimate tools", () => {
  function setup() {
    const { server, tools } = createMockServer();
    const client = createMockClient();
    registerEstimateTools(server, client);
    return { tools, client };
  }

  it("registers 3 estimate tools", () => {
    const { tools } = setup();
    expect(tools.has("qbo_list_estimates")).toBe(true);
    expect(tools.has("qbo_get_estimate")).toBe(true);
    expect(tools.has("qbo_create_estimate")).toBe(true);
  });

  it("list calls client.query for Estimate", async () => {
    const { tools, client } = setup();
    client.query.mockResolvedValue([]);
    await tools.get("qbo_list_estimates")!.handler({ maxResults: 10 });
    expect(client.query).toHaveBeenCalledWith("Estimate", undefined, 10);
  });

  it("get reads estimate by ID", async () => {
    const { tools, client } = setup();
    client.read.mockResolvedValue({ Id: "5", TotalAmt: 1000 });
    const result = await tools.get("qbo_get_estimate")!.handler({ estimateId: "5" });
    expect(client.read).toHaveBeenCalledWith("Estimate", "5");
    expect(JSON.parse(result.content[0].text).TotalAmt).toBe(1000);
  });

  it("create builds estimate with line items", async () => {
    const { tools, client } = setup();
    client.create.mockResolvedValue({ Id: "10" });

    await tools.get("qbo_create_estimate")!.handler({
      customerRef: "42",
      lineItems: [{ itemRef: "1", amount: 500, quantity: 2, unitPrice: 250 }],
      expirationDate: "2025-12-31",
    });

    const [entity, body] = client.create.mock.calls[0];
    expect(entity).toBe("Estimate");
    expect(body.CustomerRef).toEqual({ value: "42" });
    expect(body.Line).toHaveLength(1);
    expect(body.ExpirationDate).toBe("2025-12-31");
  });
});
