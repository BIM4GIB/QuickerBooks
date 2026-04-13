import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QuickBooksError, QuickBooksClient, truncateResult } from "../../src/api/client.js";
import * as tokenStore from "../../src/auth/token-store.js";
import * as oauth from "../../src/auth/oauth.js";

// ---------- truncateResult ----------

describe("truncateResult", () => {
  it("returns full JSON for small data", () => {
    const data = { id: "1", name: "Test" };
    expect(truncateResult(data)).toBe(JSON.stringify(data, null, 2));
  });

  it("truncates data exceeding 100KB", () => {
    const bigArray = Array.from({ length: 5000 }, (_, i) => ({
      id: String(i),
      name: "A".repeat(50),
      email: "test@example.com",
    }));
    const result = truncateResult(bigArray);
    expect(result.length).toBeLessThan(110_000);
    expect(result).toContain("... (truncated");
  });

  it("returns full JSON for data under 100KB", () => {
    const data = { x: "a".repeat(1000) };
    const result = truncateResult(data);
    expect(result).not.toContain("truncated");
  });
});

// ---------- QuickBooksError ----------

describe("QuickBooksError", () => {
  it("sets name, message, statusCode, and fault", () => {
    const fault = { Error: [{ Message: "Bad", Detail: "detail", code: "100" }] };
    const err = new QuickBooksError("test error", 400, fault);
    expect(err.name).toBe("QuickBooksError");
    expect(err.message).toBe("test error");
    expect(err.statusCode).toBe(400);
    expect(err.fault).toEqual(fault);
  });

  it("is an instance of Error", () => {
    const err = new QuickBooksError("msg", 500);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(QuickBooksError);
  });

  it("works without fault parameter", () => {
    const err = new QuickBooksError("no fault", 404);
    expect(err.fault).toBeUndefined();
  });
});

// ---------- Validation helpers (tested via QuickBooksClient) ----------

describe("QuickBooksClient validation", () => {
  let client: QuickBooksClient;

  beforeEach(() => {
    client = new QuickBooksClient("test-id", "test-secret");
  });

  describe("entity validation", () => {
    it("rejects invalid entity names", async () => {
      await expect(client.query("FakeEntity")).rejects.toThrow("Invalid entity");
    });

    it("accepts valid entity names", async () => {
      // Will fail at auth level, not entity validation
      const err = await client.query("Customer").catch((e: Error) => e);
      expect(err.message).not.toContain("Invalid entity");
    });
  });

  describe("entity ID validation", () => {
    it("rejects non-numeric IDs in read()", async () => {
      await expect(client.read("Customer", "abc")).rejects.toThrow("must be a numeric ID");
    });

    it("rejects path traversal in read()", async () => {
      await expect(client.read("Customer", "../hack")).rejects.toThrow("must be a numeric ID");
    });

    it("rejects empty string in read()", async () => {
      await expect(client.read("Customer", "")).rejects.toThrow("must be a numeric ID");
    });

    it("accepts numeric IDs in read()", async () => {
      // Will fail at auth level, not ID validation
      const err = await client.read("Customer", "123").catch((e: Error) => e);
      expect(err.message).not.toContain("must be a numeric ID");
    });

    it("rejects non-numeric invoice IDs in sendInvoice()", async () => {
      await expect(client.sendInvoice("abc")).rejects.toThrow("must be a numeric ID");
    });
  });

  describe("WHERE clause validation", () => {
    it("rejects MAXRESULTS in where clause", async () => {
      await expect(client.query("Customer", "1=1 MAXRESULTS 9999")).rejects.toThrow(
        "must not contain MAXRESULTS",
      );
    });

    it("rejects STARTPOSITION in where clause", async () => {
      await expect(client.query("Customer", "STARTPOSITION 100")).rejects.toThrow(
        "must not contain",
      );
    });

    it("rejects ORDERBY in where clause", async () => {
      await expect(
        client.query("Customer", "DisplayName LIKE '%A%' ORDERBY DisplayName"),
      ).rejects.toThrow("must not contain");
    });

    it("rejects case-insensitive injection keywords", async () => {
      await expect(client.query("Customer", "1=1 maxresults 500")).rejects.toThrow(
        "must not contain",
      );
      await expect(client.query("Customer", "1=1 MaxResults 500")).rejects.toThrow(
        "must not contain",
      );
    });

    it("allows valid WHERE clauses", async () => {
      // Will fail at auth level, not WHERE validation
      const err = await client.query("Customer", "DisplayName LIKE '%Smith%'").catch((e: Error) => e);
      expect(err.message).not.toContain("must not contain");
    });
  });
});

// ---------- QuickBooksClient HTTP behavior ----------

describe("QuickBooksClient HTTP requests", () => {
  const mockTokens = {
    access_token: "access_123",
    refresh_token: "refresh_456",
    token_type: "bearer",
    expires_at: Date.now() + 3600_000,
    refresh_expires_at: Date.now() + 86400_000 * 100,
    realm_id: "realm_789",
  };

  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.spyOn(tokenStore, "loadTokens").mockResolvedValue(mockTokens);
    vi.spyOn(tokenStore, "saveTokens").mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds correct query URL", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ QueryResponse: { Customer: [{ Id: "1" }] } }),
    });

    const client = new QuickBooksClient("cid", "csec");
    await client.query("Customer", "DisplayName = 'Test'", 50);

    expect(fetchSpy).toHaveBeenCalledOnce();
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("query=");
    expect(url).toContain("minorversion=73");
    expect(decodeURIComponent(url)).toContain(
      "SELECT * FROM Customer WHERE DisplayName = 'Test' MAXRESULTS 50",
    );
  });

  it("returns empty array when entity key is missing from QueryResponse", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ QueryResponse: {} }),
    });

    const client = new QuickBooksClient("cid", "csec");
    const result = await client.query("Customer");
    expect(result).toEqual([]);
  });

  it("throws QuickBooksError on non-200 response with fault", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () =>
        Promise.resolve({
          Fault: {
            Error: [
              { Message: "Business Validation Error", Detail: "secret detail", code: "6240" },
            ],
          },
        }),
    });

    const client = new QuickBooksClient("cid", "csec");
    await expect(client.query("Customer")).rejects.toThrow("Business Validation Error");
  });

  it("throws QuickBooksError on non-200 response without fault", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    });

    const client = new QuickBooksClient("cid", "csec");
    const err: QuickBooksError = await client.query("Customer").catch((e) => e);
    expect(err).toBeInstanceOf(QuickBooksError);
    expect(err.statusCode).toBe(500);
  });

  it("sends POST with JSON body for create()", async () => {
    const customerBody = { DisplayName: "New Corp" };
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ Customer: { Id: "42", ...customerBody } }),
    });

    const client = new QuickBooksClient("cid", "csec");
    const result = await client.create("Customer", customerBody);
    expect(result).toEqual({ Id: "42", DisplayName: "New Corp" });

    const [, opts] = fetchSpy.mock.calls[0];
    expect(opts.method).toBe("POST");
    expect(opts.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(opts.body)).toEqual(customerBody);
  });

  it("sends POST with ?operation=update for update()", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ Customer: { Id: "1", SyncToken: "2" } }),
    });

    const client = new QuickBooksClient("cid", "csec");
    await client.update("Customer", { Id: "1", SyncToken: "1", sparse: true });

    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("operation=update");
  });

  it("builds correct sendInvoice URL without email", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });

    const client = new QuickBooksClient("cid", "csec");
    await client.sendInvoice("42");

    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("/invoice/42/send");
    expect(url).not.toContain("sendTo");
  });

  it("builds correct sendInvoice URL with email", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });

    const client = new QuickBooksClient("cid", "csec");
    await client.sendInvoice("42", "test@example.com");

    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("/invoice/42/send");
    expect(url).toContain("sendTo=test%40example.com");
  });

  it("sets Authorization header with bearer token", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ Customer: { Id: "1" } }),
    });

    const client = new QuickBooksClient("cid", "csec");
    await client.read("Customer", "1");

    const [, opts] = fetchSpy.mock.calls[0];
    expect(opts.headers.Authorization).toBe("Bearer access_123");
  });
});

// ---------- Token management ----------

describe("QuickBooksClient token management", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws when no tokens are available", async () => {
    vi.spyOn(tokenStore, "loadTokens").mockResolvedValue(null);

    const client = new QuickBooksClient("cid", "csec");
    await expect(client.query("Customer")).rejects.toThrow("Not authenticated");
  });

  it("throws when refresh token is expired", async () => {
    vi.spyOn(tokenStore, "loadTokens").mockResolvedValue({
      access_token: "at",
      refresh_token: "rt",
      token_type: "bearer",
      expires_at: Date.now() + 3600_000,
      refresh_expires_at: Date.now() - 1000, // expired
      realm_id: "123",
    });

    const client = new QuickBooksClient("cid", "csec");
    await expect(client.query("Customer")).rejects.toThrow("Refresh token expired");
  });

  it("auto-refreshes when access token is near expiry", async () => {
    vi.spyOn(tokenStore, "loadTokens").mockResolvedValue({
      access_token: "old_access",
      refresh_token: "old_refresh",
      token_type: "bearer",
      expires_at: Date.now() - 1000, // expired
      refresh_expires_at: Date.now() + 86400_000 * 100,
      realm_id: "123",
    });
    vi.spyOn(tokenStore, "saveTokens").mockResolvedValue(undefined);

    // Token refresh call
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          access_token: "new_access",
          refresh_token: "new_refresh",
          token_type: "bearer",
          expires_in: 3600,
          x_refresh_token_expires_in: 8640000,
        }),
    });
    // Actual API request
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ QueryResponse: { Customer: [] } }),
    });

    const client = new QuickBooksClient("cid", "csec");
    await client.query("Customer");

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    // First call should be to token endpoint
    expect(fetchSpy.mock.calls[0][0]).toContain("oauth.platform.intuit.com");
  });

  it("retries with refreshed token on 401 response", async () => {
    vi.spyOn(tokenStore, "loadTokens").mockResolvedValue({
      access_token: "old_access",
      refresh_token: "old_refresh",
      token_type: "bearer",
      expires_at: Date.now() + 3600_000, // not expired yet, but server rejects
      refresh_expires_at: Date.now() + 86400_000 * 100,
      realm_id: "123",
    });
    vi.spyOn(tokenStore, "saveTokens").mockResolvedValue(undefined);

    // First API call: 401
    fetchSpy.mockResolvedValueOnce({ ok: false, status: 401 });
    // Token refresh
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          access_token: "new_access",
          refresh_token: "new_refresh",
          token_type: "bearer",
          expires_in: 3600,
          x_refresh_token_expires_in: 8640000,
        }),
    });
    // Retry API call: success
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ Customer: { Id: "1" } }),
    });

    const client = new QuickBooksClient("cid", "csec");
    const result = await client.read("Customer", "1");
    expect(result).toEqual({ Id: "1" });
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });
});
