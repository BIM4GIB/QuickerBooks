import { describe, it, expect } from "vitest";
import { registerAccountTools } from "../../src/tools/accounts.js";
import { createMockServer, createMockClient } from "./helpers.js";

describe("account tools", () => {
  function setup() {
    const { server, tools } = createMockServer();
    const client = createMockClient();
    registerAccountTools(server, client);
    return { tools, client };
  }

  it("registers 2 account tools", () => {
    const { tools } = setup();
    expect(tools.has("qbo_list_accounts")).toBe(true);
    expect(tools.has("qbo_get_account")).toBe(true);
  });

  it("list calls client.query for Account", async () => {
    const { tools, client } = setup();
    client.query.mockResolvedValue([{ Id: "1", Name: "Checking" }]);
    await tools.get("qbo_list_accounts")!.handler({
      query: "AccountType = 'Bank'",
      maxResults: 50,
    });
    expect(client.query).toHaveBeenCalledWith("Account", "AccountType = 'Bank'", 50);
  });

  it("get reads account by ID", async () => {
    const { tools, client } = setup();
    client.read.mockResolvedValue({ Id: "1", Name: "Checking", CurrentBalance: 5000 });
    const result = await tools.get("qbo_get_account")!.handler({ accountId: "1" });
    expect(client.read).toHaveBeenCalledWith("Account", "1");
    expect(JSON.parse(result.content[0].text).CurrentBalance).toBe(5000);
  });
});
