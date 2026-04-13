import { describe, it, expect } from "vitest";
import { registerBillTools } from "../../src/tools/bills.js";
import { createMockServer, createMockClient } from "./helpers.js";

describe("bill tools", () => {
  function setup() {
    const { server, tools } = createMockServer();
    const client = createMockClient();
    registerBillTools(server, client);
    return { tools, client };
  }

  it("registers 3 bill tools", () => {
    const { tools } = setup();
    expect(tools.has("qbo_list_bills")).toBe(true);
    expect(tools.has("qbo_get_bill")).toBe(true);
    expect(tools.has("qbo_create_bill")).toBe(true);
  });

  it("list calls client.query for Bill", async () => {
    const { tools, client } = setup();
    client.query.mockResolvedValue([]);
    await tools.get("qbo_list_bills")!.handler({ maxResults: 20 });
    expect(client.query).toHaveBeenCalledWith("Bill", undefined, 20);
  });

  it("get reads bill by ID", async () => {
    const { tools, client } = setup();
    client.read.mockResolvedValue({ Id: "7", Balance: 300 });
    const result = await tools.get("qbo_get_bill")!.handler({ billId: "7" });
    expect(client.read).toHaveBeenCalledWith("Bill", "7");
    expect(JSON.parse(result.content[0].text).Balance).toBe(300);
  });

  it("create builds bill with account-based lines", async () => {
    const { tools, client } = setup();
    client.create.mockResolvedValue({ Id: "15" });

    await tools.get("qbo_create_bill")!.handler({
      vendorRef: "10",
      lineItems: [{ accountRef: "50", amount: 200 }],
      dueDate: "2025-06-30",
    });

    const [entity, body] = client.create.mock.calls[0];
    expect(entity).toBe("Bill");
    expect(body.VendorRef).toEqual({ value: "10" });
    expect(body.Line[0].DetailType).toBe("AccountBasedExpenseLineDetail");
    expect(body.Line[0].AccountBasedExpenseLineDetail.AccountRef).toEqual({ value: "50" });
    expect(body.DueDate).toBe("2025-06-30");
  });
});
