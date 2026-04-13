import { describe, it, expect } from "vitest";
import { registerItemTools } from "../../src/tools/items.js";
import { createMockServer, createMockClient } from "./helpers.js";

describe("item tools", () => {
  function setup() {
    const { server, tools } = createMockServer();
    const client = createMockClient();
    registerItemTools(server, client);
    return { tools, client };
  }

  it("registers 4 item tools", () => {
    const { tools } = setup();
    expect(tools.has("qbo_list_items")).toBe(true);
    expect(tools.has("qbo_get_item")).toBe(true);
    expect(tools.has("qbo_create_item")).toBe(true);
    expect(tools.has("qbo_update_item")).toBe(true);
  });

  // --- list ---

  describe("qbo_list_items", () => {
    it("calls client.query for items", async () => {
      const { tools, client } = setup();
      client.query.mockResolvedValue([{ Id: "1", Name: "Widget" }]);

      await tools.get("qbo_list_items")!.handler({
        query: "Name LIKE '%Widget%'",
        maxResults: 30,
      });

      expect(client.query).toHaveBeenCalledWith("Item", "Name LIKE '%Widget%'", 30);
    });
  });

  // --- get ---

  describe("qbo_get_item", () => {
    it("reads item by ID", async () => {
      const { tools, client } = setup();
      client.read.mockResolvedValue({ Id: "7", Name: "Service A" });

      const result = await tools.get("qbo_get_item")!.handler({ itemId: "7" });
      expect(client.read).toHaveBeenCalledWith("Item", "7");
      expect(JSON.parse(result.content[0].text).Name).toBe("Service A");
    });
  });

  // --- create ---

  describe("qbo_create_item", () => {
    it("creates service item with defaults", async () => {
      const { tools, client } = setup();
      client.create.mockResolvedValue({ Id: "20" });

      await tools.get("qbo_create_item")!.handler({
        name: "Consulting",
        type: "Service",
      });

      const body = client.create.mock.calls[0][1];
      expect(body.Name).toBe("Consulting");
      expect(body.Type).toBe("Service");
      expect(body.UnitPrice).toBeUndefined();
      expect(body.IncomeAccountRef).toBeUndefined();
    });

    it("creates item with all optional fields", async () => {
      const { tools, client } = setup();
      client.create.mockResolvedValue({ Id: "21" });

      await tools.get("qbo_create_item")!.handler({
        name: "Widget",
        type: "Inventory",
        unitPrice: 29.99,
        incomeAccountRef: "100",
        expenseAccountRef: "200",
      });

      const body = client.create.mock.calls[0][1];
      expect(body.Name).toBe("Widget");
      expect(body.Type).toBe("Inventory");
      expect(body.UnitPrice).toBe(29.99);
      expect(body.IncomeAccountRef).toEqual({ value: "100" });
      expect(body.ExpenseAccountRef).toEqual({ value: "200" });
    });
  });

  // --- update ---

  describe("qbo_update_item", () => {
    it("sends sparse update with only provided fields", async () => {
      const { tools, client } = setup();
      client.update.mockResolvedValue({ Id: "7" });

      await tools.get("qbo_update_item")!.handler({
        itemId: "7",
        syncToken: "2",
        unitPrice: 39.99,
      });

      const body = client.update.mock.calls[0][1];
      expect(body.Id).toBe("7");
      expect(body.SyncToken).toBe("2");
      expect(body.sparse).toBe(true);
      expect(body.UnitPrice).toBe(39.99);
      expect(body.Name).toBeUndefined();
      expect(body.Type).toBeUndefined();
    });

    it("updates name and type", async () => {
      const { tools, client } = setup();
      client.update.mockResolvedValue({ Id: "7" });

      await tools.get("qbo_update_item")!.handler({
        itemId: "7",
        syncToken: "2",
        name: "New Name",
        type: "NonInventory",
      });

      const body = client.update.mock.calls[0][1];
      expect(body.Name).toBe("New Name");
      expect(body.Type).toBe("NonInventory");
    });
  });
});
