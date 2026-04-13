import { describe, it, expect } from "vitest";
import { registerPaymentTools } from "../../src/tools/payments.js";
import { createMockServer, createMockClient } from "./helpers.js";

describe("payment tools", () => {
  function setup() {
    const { server, tools } = createMockServer();
    const client = createMockClient();
    registerPaymentTools(server, client);
    return { tools, client };
  }

  it("registers 3 payment tools", () => {
    const { tools } = setup();
    expect(tools.has("qbo_list_payments")).toBe(true);
    expect(tools.has("qbo_get_payment")).toBe(true);
    expect(tools.has("qbo_create_payment")).toBe(true);
  });

  // --- list ---

  describe("qbo_list_payments", () => {
    it("calls client.query for payments", async () => {
      const { tools, client } = setup();
      client.query.mockResolvedValue([{ Id: "50" }]);

      await tools.get("qbo_list_payments")!.handler({ maxResults: 10 });

      expect(client.query).toHaveBeenCalledWith("Payment", undefined, 10);
    });
  });

  // --- get ---

  describe("qbo_get_payment", () => {
    it("reads payment by ID", async () => {
      const { tools, client } = setup();
      client.read.mockResolvedValue({ Id: "50", TotalAmt: 250 });

      const result = await tools.get("qbo_get_payment")!.handler({ paymentId: "50" });

      expect(client.read).toHaveBeenCalledWith("Payment", "50");
      expect(JSON.parse(result.content[0].text).TotalAmt).toBe(250);
    });
  });

  // --- create ---

  describe("qbo_create_payment", () => {
    it("creates payment without invoice link", async () => {
      const { tools, client } = setup();
      client.create.mockResolvedValue({ Id: "60" });

      await tools.get("qbo_create_payment")!.handler({
        customerRef: "42",
        totalAmount: 500,
      });

      const [entity, body] = client.create.mock.calls[0];
      expect(entity).toBe("Payment");
      expect(body.CustomerRef).toEqual({ value: "42" });
      expect(body.TotalAmt).toBe(500);
      expect(body.Line).toBeUndefined();
      expect(body.TxnDate).toBeUndefined();
    });

    it("creates payment linked to an invoice", async () => {
      const { tools, client } = setup();
      client.create.mockResolvedValue({ Id: "61" });

      await tools.get("qbo_create_payment")!.handler({
        customerRef: "42",
        totalAmount: 300,
        invoiceId: "100",
        paymentDate: "2025-06-15",
      });

      const body = client.create.mock.calls[0][1];
      expect(body.TxnDate).toBe("2025-06-15");
      expect(body.Line).toEqual([
        {
          Amount: 300,
          LinkedTxn: [{ TxnId: "100", TxnType: "Invoice" }],
        },
      ]);
    });

    it("returns error on failure", async () => {
      const { tools, client } = setup();
      client.create.mockRejectedValue(new Error("duplicate"));

      const result = await tools.get("qbo_create_payment")!.handler({
        customerRef: "42",
        totalAmount: 100,
      });
      expect(result.isError).toBe(true);
    });
  });
});
