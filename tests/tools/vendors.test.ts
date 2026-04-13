import { describe, it, expect } from "vitest";
import { registerVendorTools } from "../../src/tools/vendors.js";
import { createMockServer, createMockClient } from "./helpers.js";

describe("vendor tools", () => {
  function setup() {
    const { server, tools } = createMockServer();
    const client = createMockClient();
    registerVendorTools(server, client);
    return { tools, client };
  }

  it("registers 4 vendor tools", () => {
    const { tools } = setup();
    expect(tools.has("qbo_list_vendors")).toBe(true);
    expect(tools.has("qbo_get_vendor")).toBe(true);
    expect(tools.has("qbo_create_vendor")).toBe(true);
    expect(tools.has("qbo_update_vendor")).toBe(true);
  });

  // --- list ---

  describe("qbo_list_vendors", () => {
    it("calls client.query for vendors", async () => {
      const { tools, client } = setup();
      client.query.mockResolvedValue([]);

      await tools.get("qbo_list_vendors")!.handler({
        query: "DisplayName LIKE '%Supply%'",
        maxResults: 20,
      });

      expect(client.query).toHaveBeenCalledWith("Vendor", "DisplayName LIKE '%Supply%'", 20);
    });
  });

  // --- get ---

  describe("qbo_get_vendor", () => {
    it("reads vendor by ID", async () => {
      const { tools, client } = setup();
      client.read.mockResolvedValue({ Id: "10", DisplayName: "Acme Supply" });

      const result = await tools.get("qbo_get_vendor")!.handler({ vendorId: "10" });
      expect(client.read).toHaveBeenCalledWith("Vendor", "10");
      expect(JSON.parse(result.content[0].text).DisplayName).toBe("Acme Supply");
    });
  });

  // --- create ---

  describe("qbo_create_vendor", () => {
    it("creates vendor with all fields", async () => {
      const { tools, client } = setup();
      client.create.mockResolvedValue({ Id: "11" });

      await tools.get("qbo_create_vendor")!.handler({
        displayName: "New Vendor",
        email: "vendor@test.com",
        phone: "555-9999",
        companyName: "Vendor Co",
        givenName: "Bob",
        familyName: "Smith",
      });

      const body = client.create.mock.calls[0][1];
      expect(body.DisplayName).toBe("New Vendor");
      expect(body.PrimaryEmailAddr).toEqual({ Address: "vendor@test.com" });
      expect(body.PrimaryPhone).toEqual({ FreeFormNumber: "555-9999" });
      expect(body.CompanyName).toBe("Vendor Co");
      expect(body.GivenName).toBe("Bob");
      expect(body.FamilyName).toBe("Smith");
    });

    it("creates vendor with only display name", async () => {
      const { tools, client } = setup();
      client.create.mockResolvedValue({ Id: "12" });

      await tools.get("qbo_create_vendor")!.handler({ displayName: "Minimal" });

      const body = client.create.mock.calls[0][1];
      expect(body.DisplayName).toBe("Minimal");
      expect(body.PrimaryEmailAddr).toBeUndefined();
    });
  });

  // --- update ---

  describe("qbo_update_vendor", () => {
    it("sends sparse update", async () => {
      const { tools, client } = setup();
      client.update.mockResolvedValue({ Id: "10" });

      await tools.get("qbo_update_vendor")!.handler({
        vendorId: "10",
        syncToken: "3",
        companyName: "New Company Name",
      });

      const body = client.update.mock.calls[0][1];
      expect(body.Id).toBe("10");
      expect(body.SyncToken).toBe("3");
      expect(body.sparse).toBe(true);
      expect(body.CompanyName).toBe("New Company Name");
    });
  });
});
