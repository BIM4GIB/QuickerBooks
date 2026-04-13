import { describe, it, expect } from "vitest";
import { registerInvoiceTools } from "../../src/tools/invoices.js";
import { createMockServer, createMockClient } from "./helpers.js";

describe("invoice tools", () => {
  function setup() {
    const { server, tools } = createMockServer();
    const client = createMockClient();
    registerInvoiceTools(server, client);
    return { tools, client };
  }

  it("registers 4 invoice tools", () => {
    const { tools } = setup();
    expect(tools.has("qbo_list_invoices")).toBe(true);
    expect(tools.has("qbo_get_invoice")).toBe(true);
    expect(tools.has("qbo_create_invoice")).toBe(true);
    expect(tools.has("qbo_send_invoice")).toBe(true);
  });

  // --- list ---

  describe("qbo_list_invoices", () => {
    it("calls client.query for invoices", async () => {
      const { tools, client } = setup();
      client.query.mockResolvedValue([{ Id: "100" }]);

      const result = await tools.get("qbo_list_invoices")!.handler({
        query: "Balance > '0'",
        maxResults: 50,
      });

      expect(client.query).toHaveBeenCalledWith("Invoice", "Balance > '0'", 50);
      expect(result.isError).toBeUndefined();
    });
  });

  // --- get ---

  describe("qbo_get_invoice", () => {
    it("reads invoice by ID", async () => {
      const { tools, client } = setup();
      const invoice = { Id: "100", TotalAmt: 500 };
      client.read.mockResolvedValue(invoice);

      const result = await tools.get("qbo_get_invoice")!.handler({ invoiceId: "100" });

      expect(client.read).toHaveBeenCalledWith("Invoice", "100");
      expect(JSON.parse(result.content[0].text)).toEqual(invoice);
    });
  });

  // --- create ---

  describe("qbo_create_invoice", () => {
    it("creates invoice with line items", async () => {
      const { tools, client } = setup();
      client.create.mockResolvedValue({ Id: "200", TotalAmt: 150 });

      await tools.get("qbo_create_invoice")!.handler({
        customerRef: "42",
        lineItems: [
          { itemRef: "1", amount: 100, quantity: 2, unitPrice: 50 },
          { itemRef: "2", amount: 50 },
        ],
        dueDate: "2025-12-31",
        txnDate: "2025-01-01",
      });

      const [entity, body] = client.create.mock.calls[0];
      expect(entity).toBe("Invoice");
      expect(body.CustomerRef).toEqual({ value: "42" });
      expect(body.DueDate).toBe("2025-12-31");
      expect(body.TxnDate).toBe("2025-01-01");
      expect(body.Line).toHaveLength(2);
      expect(body.Line[0]).toEqual({
        Amount: 100,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: { value: "1" },
          Qty: 2,
          UnitPrice: 50,
        },
      });
      expect(body.Line[1].SalesItemLineDetail.ItemRef).toEqual({ value: "2" });
    });

    it("creates invoice without optional dates", async () => {
      const { tools, client } = setup();
      client.create.mockResolvedValue({ Id: "201" });

      await tools.get("qbo_create_invoice")!.handler({
        customerRef: "42",
        lineItems: [{ itemRef: "1", amount: 100 }],
      });

      const body = client.create.mock.calls[0][1];
      expect(body.DueDate).toBeUndefined();
      expect(body.TxnDate).toBeUndefined();
    });

    it("handles line item without explicit quantity", async () => {
      const { tools, client } = setup();
      client.create.mockResolvedValue({ Id: "202" });

      await tools.get("qbo_create_invoice")!.handler({
        customerRef: "42",
        lineItems: [{ itemRef: "1", amount: 100 }],
      });

      const body = client.create.mock.calls[0][1];
      // Line item should be created with the provided amount
      expect(body.Line[0].Amount).toBe(100);
      expect(body.Line[0].SalesItemLineDetail.ItemRef).toEqual({ value: "1" });
    });
  });

  // --- send ---

  describe("qbo_send_invoice", () => {
    it("sends invoice without email override", async () => {
      const { tools, client } = setup();
      client.sendInvoice.mockResolvedValue(undefined);

      const result = await tools.get("qbo_send_invoice")!.handler({ invoiceId: "100" });

      expect(client.sendInvoice).toHaveBeenCalledWith("100", undefined);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);
      expect(parsed.message).toContain("100");
    });

    it("sends invoice with email override", async () => {
      const { tools, client } = setup();
      client.sendInvoice.mockResolvedValue(undefined);

      await tools.get("qbo_send_invoice")!.handler({
        invoiceId: "100",
        email: "override@test.com",
      });

      expect(client.sendInvoice).toHaveBeenCalledWith("100", "override@test.com");
    });

    it("returns error on failure", async () => {
      const { tools, client } = setup();
      client.sendInvoice.mockRejectedValue(new Error("send failed"));

      const result = await tools.get("qbo_send_invoice")!.handler({ invoiceId: "100" });
      expect(result.isError).toBe(true);
    });
  });
});
