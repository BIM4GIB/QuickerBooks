import { describe, it, expect, vi, afterEach } from "vitest";
import { buildAuthUrl, exchangeCode, refreshAccessToken, startOAuthCallbackServer } from "../../src/auth/oauth.js";
import * as tokenStore from "../../src/auth/token-store.js";
import http from "node:http";

describe("buildAuthUrl", () => {
  const config = {
    clientId: "test_client_id",
    clientSecret: "test_client_secret",
    redirectUri: "http://localhost:9876/callback",
  };

  it("returns a URL with all required OAuth params", () => {
    const { url } = buildAuthUrl(config);
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe("https://appcenter.intuit.com/connect/oauth2");
    expect(parsed.searchParams.get("client_id")).toBe("test_client_id");
    expect(parsed.searchParams.get("redirect_uri")).toBe("http://localhost:9876/callback");
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("scope")).toBe("com.intuit.quickbooks.accounting");
  });

  it("includes PKCE code_challenge with S256 method", () => {
    const { url } = buildAuthUrl(config);
    const parsed = new URL(url);
    expect(parsed.searchParams.get("code_challenge")).toBeTruthy();
    expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("generates a 32-char hex state", () => {
    const { state } = buildAuthUrl(config);
    expect(state).toMatch(/^[0-9a-f]{32}$/);
  });

  it("generates a base64url code verifier", () => {
    const { codeVerifier } = buildAuthUrl(config);
    expect(codeVerifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(codeVerifier.length).toBeGreaterThan(20);
  });

  it("generates unique state and codeVerifier on each call", () => {
    const a = buildAuthUrl(config);
    const b = buildAuthUrl(config);
    expect(a.state).not.toBe(b.state);
    expect(a.codeVerifier).not.toBe(b.codeVerifier);
  });
});

describe("exchangeCode", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const config = {
    clientId: "cid",
    clientSecret: "csec",
    redirectUri: "http://localhost:9876/callback",
  };

  it("exchanges code for tokens on success", async () => {
    const now = Date.now();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "at_123",
            refresh_token: "rt_456",
            token_type: "bearer",
            expires_in: 3600,
            x_refresh_token_expires_in: 8640000,
          }),
      }),
    );

    const tokens = await exchangeCode("auth_code", "realm_1", config, "verifier_1");
    expect(tokens.access_token).toBe("at_123");
    expect(tokens.refresh_token).toBe("rt_456");
    expect(tokens.realm_id).toBe("realm_1");
    expect(tokens.expires_at).toBeGreaterThanOrEqual(now + 3600 * 1000 - 100);
    expect(tokens.refresh_expires_at).toBeGreaterThanOrEqual(now + 8640000 * 1000 - 100);
  });

  it("sends correct headers and body", async () => {
    const fetchSpy = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "a",
          refresh_token: "r",
          token_type: "bearer",
          expires_in: 3600,
          x_refresh_token_expires_in: 8640000,
        }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    await exchangeCode("the_code", "realm", config, "the_verifier");

    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer");
    expect(opts.method).toBe("POST");
    expect(opts.headers.Authorization).toMatch(/^Basic /);
    expect(opts.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");

    const body = new URLSearchParams(opts.body);
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("the_code");
    expect(body.get("code_verifier")).toBe("the_verifier");
    expect(body.get("redirect_uri")).toBe("http://localhost:9876/callback");
  });

  it("encodes Basic auth correctly", async () => {
    const fetchSpy = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "a",
          refresh_token: "r",
          token_type: "bearer",
          expires_in: 3600,
          x_refresh_token_expires_in: 8640000,
        }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    await exchangeCode("c", "r", config, "v");

    const authHeader = fetchSpy.mock.calls[0][1].headers.Authorization;
    const decoded = Buffer.from(authHeader.replace("Basic ", ""), "base64").toString();
    expect(decoded).toBe("cid:csec");
  });

  it("throws on non-OK response without leaking body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve("super secret debug info"),
      }),
    );

    await expect(exchangeCode("bad", "r", config, "v")).rejects.toThrow(
      "Token exchange failed (HTTP 400)",
    );
  });
});

describe("refreshAccessToken", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const config = {
    clientId: "cid",
    clientSecret: "csec",
    redirectUri: "",
  };

  it("refreshes tokens on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "new_at",
            refresh_token: "new_rt",
            token_type: "bearer",
            expires_in: 3600,
            x_refresh_token_expires_in: 8640000,
          }),
      }),
    );

    const tokens = await refreshAccessToken("old_rt", "realm_1", config);
    expect(tokens.access_token).toBe("new_at");
    expect(tokens.refresh_token).toBe("new_rt");
    expect(tokens.realm_id).toBe("realm_1");
  });

  it("sends grant_type=refresh_token", async () => {
    const fetchSpy = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "a",
          refresh_token: "r",
          token_type: "bearer",
          expires_in: 3600,
          x_refresh_token_expires_in: 8640000,
        }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    await refreshAccessToken("the_rt", "realm", config);

    const body = new URLSearchParams(fetchSpy.mock.calls[0][1].body);
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("the_rt");
  });

  it("throws helpful message on failure without leaking body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve("internal error details"),
      }),
    );

    await expect(refreshAccessToken("bad_rt", "r", config)).rejects.toThrow(
      "Token refresh failed (HTTP 401)",
    );
  });
});

// Use unique port per test to avoid EADDRINUSE
let nextPort = 29800;
function uniquePort(): number {
  return nextPort++;
}

function httpGet(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode!, body }));
      })
      .on("error", reject);
  });
}

describe("startOAuthCallbackServer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("rejects requests to wrong path with 404", async () => {
    const port = uniquePort();
    const config = {
      clientId: "cid",
      clientSecret: "csec",
      redirectUri: `http://localhost:${port}/callback`,
    };

    vi.stubGlobal("fetch", vi.fn());
    vi.spyOn(tokenStore, "saveTokens").mockResolvedValue(undefined);

    const serverPromise = startOAuthCallbackServer(config, "state123", "verifier");
    // Attach catch immediately to prevent unhandled rejection
    const caughtPromise = serverPromise.catch((e) => e);
    await new Promise((r) => setTimeout(r, 100));

    const res = await httpGet(`http://127.0.0.1:${port}/wrong-path`);
    expect(res.status).toBe(404);

    // Clean up by sending mismatched state (will reject the promise)
    await httpGet(`http://127.0.0.1:${port}/callback?code=x&realmId=1&state=bad`);
    const err = await caughtPromise;
    expect(err).toBeInstanceOf(Error);
  });

  it("rejects with state mismatch error", async () => {
    const port = uniquePort();
    const config = {
      clientId: "cid",
      clientSecret: "csec",
      redirectUri: `http://localhost:${port}/callback`,
    };

    vi.stubGlobal("fetch", vi.fn());

    const serverPromise = startOAuthCallbackServer(config, "correct_state", "verifier");
    const caughtPromise = serverPromise.catch((e) => e);
    await new Promise((r) => setTimeout(r, 100));

    const res = await httpGet(
      `http://127.0.0.1:${port}/callback?code=test&realmId=123&state=WRONG`,
    );
    expect(res.status).toBe(400);
    expect(res.body).toContain("State mismatch");

    const err = await caughtPromise;
    expect(err.message).toContain("state mismatch");
  });

  it("rejects when code or realmId missing", async () => {
    const port = uniquePort();
    const config = {
      clientId: "cid",
      clientSecret: "csec",
      redirectUri: `http://localhost:${port}/callback`,
    };

    vi.stubGlobal("fetch", vi.fn());

    const serverPromise = startOAuthCallbackServer(config, "state1", "verifier");
    const caughtPromise = serverPromise.catch((e) => e);
    await new Promise((r) => setTimeout(r, 100));

    const res = await httpGet(`http://127.0.0.1:${port}/callback?state=state1`);
    expect(res.status).toBe(400);

    const err = await caughtPromise;
    expect(err.message).toContain("Missing code or realmId");
  });

  it("rejects on OAuth error parameter", async () => {
    const port = uniquePort();
    const config = {
      clientId: "cid",
      clientSecret: "csec",
      redirectUri: `http://localhost:${port}/callback`,
    };

    vi.stubGlobal("fetch", vi.fn());

    const serverPromise = startOAuthCallbackServer(config, "state1", "verifier");
    const caughtPromise = serverPromise.catch((e) => e);
    await new Promise((r) => setTimeout(r, 100));

    const res = await httpGet(
      `http://127.0.0.1:${port}/callback?error=access_denied&state=state1`,
    );
    expect(res.status).toBe(400);
    expect(res.body).toContain("access_denied");

    const err = await caughtPromise;
    expect(err.message).toContain("OAuth error");
  });

  it("uses text/plain for error responses (XSS prevention)", async () => {
    const port = uniquePort();
    const config = {
      clientId: "cid",
      clientSecret: "csec",
      redirectUri: `http://localhost:${port}/callback`,
    };

    vi.stubGlobal("fetch", vi.fn());

    const serverPromise = startOAuthCallbackServer(config, "state1", "verifier");
    const caughtPromise = serverPromise.catch((e) => e);
    await new Promise((r) => setTimeout(r, 100));

    const res = await httpGet(
      `http://127.0.0.1:${port}/callback?error=<script>alert(1)</script>&state=state1`,
    );
    expect(res.status).toBe(400);

    const err = await caughtPromise;
    expect(err.message).toContain("OAuth error");
  });

  it("resolves with tokens on successful callback", async () => {
    const port = uniquePort();
    const config = {
      clientId: "cid",
      clientSecret: "csec",
      redirectUri: `http://localhost:${port}/callback`,
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "at_good",
            refresh_token: "rt_good",
            token_type: "bearer",
            expires_in: 3600,
            x_refresh_token_expires_in: 8640000,
          }),
      }),
    );
    vi.spyOn(tokenStore, "saveTokens").mockResolvedValue(undefined);

    const serverPromise = startOAuthCallbackServer(config, "valid_state", "verifier");
    await new Promise((r) => setTimeout(r, 100));

    const res = await httpGet(
      `http://127.0.0.1:${port}/callback?code=auth_code&realmId=realm_99&state=valid_state`,
    );
    expect(res.status).toBe(200);
    expect(res.body).toContain("successful");

    const tokens = await serverPromise;
    expect(tokens.access_token).toBe("at_good");
    expect(tokens.realm_id).toBe("realm_99");
  });
});
