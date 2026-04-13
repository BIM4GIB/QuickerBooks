import { describe, it, expect } from "vitest";
import { registerJournalEntryTools } from "../../src/tools/journal-entries.js";
import { createMockServer, createMockClient } from "./helpers.js";

describe("journal entry tools", () => {
  function setup() {
    const { server, tools } = createMockServer();
    const client = createMockClient();
    registerJournalEntryTools(server, client);
    return { tools, client };
  }

  it("registers 3 journal entry tools", () => {
    const { tools } = setup();
    expect(tools.has("qbo_list_journal_entries")).toBe(true);
    expect(tools.has("qbo_get_journal_entry")).toBe(true);
    expect(tools.has("qbo_create_journal_entry")).toBe(true);
  });

  it("list calls client.query for JournalEntry", async () => {
    const { tools, client } = setup();
    client.query.mockResolvedValue([]);
    await tools.get("qbo_list_journal_entries")!.handler({ maxResults: 5 });
    expect(client.query).toHaveBeenCalledWith("JournalEntry", undefined, 5);
  });

  it("get reads journal entry by ID", async () => {
    const { tools, client } = setup();
    client.read.mockResolvedValue({ Id: "20", TotalAmt: 1000 });
    const result = await tools.get("qbo_get_journal_entry")!.handler({ journalEntryId: "20" });
    expect(client.read).toHaveBeenCalledWith("JournalEntry", "20");
    expect(JSON.parse(result.content[0].text).TotalAmt).toBe(1000);
  });

  it("create builds journal entry with debit and credit lines", async () => {
    const { tools, client } = setup();
    client.create.mockResolvedValue({ Id: "25" });

    await tools.get("qbo_create_journal_entry")!.handler({
      lines: [
        { postingType: "Debit", accountRef: "100", amount: 500, description: "Office supplies" },
        { postingType: "Credit", accountRef: "200", amount: 500 },
      ],
      txnDate: "2025-03-15",
    });

    const [entity, body] = client.create.mock.calls[0];
    expect(entity).toBe("JournalEntry");
    expect(body.Line).toHaveLength(2);
    expect(body.Line[0].JournalEntryLineDetail.PostingType).toBe("Debit");
    expect(body.Line[0].JournalEntryLineDetail.AccountRef).toEqual({ value: "100" });
    expect(body.Line[0].JournalEntryLineDetail.Description).toBe("Office supplies");
    expect(body.Line[1].JournalEntryLineDetail.PostingType).toBe("Credit");
    expect(body.TxnDate).toBe("2025-03-15");
  });
});
