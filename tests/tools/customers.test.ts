import { describe, it, expect } from "vitest";
import { registerCustomerTools } from "../../src/tools/customers.js";
import { createMockServer, createMockClient } from "./helpers.js";

describe("customer tools", () => {
  function setup() {
    const { server, tools } = createMockServer();
    const client = createMockClient();
    registerCustomerTools(server, client);
    return { tools, client };
  }

  it("registers 4 customer tools", () => {
    const { tools } = setup();
    expect(tools.has("qbo_list_customers")).toBe(true);
    expect(tools.has("qbo_get_customer")).toBe(true);
    expect(tools.has("qbo_create_customer")).toBe(true);
    expect(tools.has("qbo_update_customer")).toBe(true);
  });

  // --- list ---

  describe("qbo_list_customers", () => {
    it("calls client.query with entity and params", async () => {
      const { tools, client } = setup();
      client.query.mockResolvedValue([{ Id: "1" }]);

      const result = await tools.get("qbo_list_customers")!.handler({
        query: "DisplayName LIKE '%Test%'",
        maxResults: 10,
      });

      expect(client.query).toHaveBeenCalledWith("Customer", "DisplayName LIKE '%Test%'", 10);
      expect(JSON.parse(result.content[0].text)).toEqual([{ Id: "1" }]);
    });

    it("passes undefined query when not provided", async () => {
      const { tools, client } = setup();
      client.query.mockResolvedValue([]);

      await tools.get("qbo_list_customers")!.handler({ maxResults: 25 });

      expect(client.query).toHaveBeenCalledWith("Customer", undefined, 25);
    });

    it("returns error on failure", async () => {
      const { tools, client } = setup();
      client.query.mockRejectedValue(new Error("timeout"));

      const result = await tools.get("qbo_list_customers")!.handler({ maxResults: 25 });
      expect(result.isError).toBe(true);
    });
  });

  // --- get ---

  describe("qbo_get_customer", () => {
    it("calls client.read with correct entity and ID", async () => {
      const { tools, client } = setup();
      const customer = { Id: "42", DisplayName: "Jane" };
      client.read.mockResolvedValue(customer);

      const result = await tools.get("qbo_get_customer")!.handler({ customerId: "42" });

      expect(client.read).toHaveBeenCalledWith("Customer", "42");
      expect(JSON.parse(result.content[0].text)).toEqual(customer);
    });
  });

  // --- create ---

  describe("qbo_create_customer", () => {
    it("creates customer with all fields", async () => {
      const { tools, client } = setup();
      client.create.mockResolvedValue({ Id: "99" });

      await tools.get("qbo_create_customer")!.handler({
        displayName: "Acme Corp",
        email: "info@acme.com",
        phone: "555-1234",
        companyName: "Acme",
        givenName: "John",
        familyName: "Doe",
      });

      const [entity, body] = client.create.mock.calls[0];
      expect(entity).toBe("Customer");
      expect(body.DisplayName).toBe("Acme Corp");
      expect(body.PrimaryEmailAddr).toEqual({ Address: "info@acme.com" });
      expect(body.PrimaryPhone).toEqual({ FreeFormNumber: "555-1234" });
      expect(body.CompanyName).toBe("Acme");
      expect(body.GivenName).toBe("John");
      expect(body.FamilyName).toBe("Doe");
    });

    it("creates customer with only required field", async () => {
      const { tools, client } = setup();
      client.create.mockResolvedValue({ Id: "1" });

      await tools.get("qbo_create_customer")!.handler({
        displayName: "Minimal Customer",
      });

      const body = client.create.mock.calls[0][1];
      expect(body.DisplayName).toBe("Minimal Customer");
      expect(body.PrimaryEmailAddr).toBeUndefined();
      expect(body.PrimaryPhone).toBeUndefined();
      expect(body.CompanyName).toBeUndefined();
    });
  });

  // --- update ---

  describe("qbo_update_customer", () => {
    it("sends sparse update with Id and SyncToken", async () => {
      const { tools, client } = setup();
      client.update.mockResolvedValue({ Id: "5", SyncToken: "2" });

      await tools.get("qbo_update_customer")!.handler({
        customerId: "5",
        syncToken: "1",
        displayName: "Updated Name",
        email: "new@email.com",
      });

      const [entity, body] = client.update.mock.calls[0];
      expect(entity).toBe("Customer");
      expect(body.Id).toBe("5");
      expect(body.SyncToken).toBe("1");
      expect(body.sparse).toBe(true);
      expect(body.DisplayName).toBe("Updated Name");
      expect(body.PrimaryEmailAddr).toEqual({ Address: "new@email.com" });
    });

    it("only includes provided optional fields", async () => {
      const { tools, client } = setup();
      client.update.mockResolvedValue({ Id: "5" });

      await tools.get("qbo_update_customer")!.handler({
        customerId: "5",
        syncToken: "1",
      });

      const body = client.update.mock.calls[0][1];
      expect(body.Id).toBe("5");
      expect(body.SyncToken).toBe("1");
      expect(body.sparse).toBe(true);
      expect(body.DisplayName).toBeUndefined();
      expect(body.PrimaryEmailAddr).toBeUndefined();
    });
  });
});
