import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import { randomBytes, createHash } from "node:crypto";
import type { TokenData } from "./types.js";
import { saveTokens } from "./token-store.js";

const AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const SCOPE = "com.intuit.quickbooks.accounting";

const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

function basicAuth(clientId: string, clientSecret: string): string {
  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

// PKCE helpers (S256)
function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function buildAuthUrl(config: OAuthConfig): {
  url: string;
  state: string;
  codeVerifier: string;
} {
  const state = randomBytes(16).toString("hex");
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: SCOPE,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return { url: `${AUTH_URL}?${params}`, state, codeVerifier };
}

export async function exchangeCode(
  code: string,
  realmId: string,
  config: OAuthConfig,
  codeVerifier: string,
): Promise<TokenData> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Authorization: `Basic ${basicAuth(config.clientId, config.clientSecret)}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  if (!res.ok) {
    // Don't leak raw Intuit response body — it may contain debug info
    throw new Error(`Token exchange failed (HTTP ${res.status}). Check your app credentials.`);
  }

  const body = await res.json() as {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
    x_refresh_token_expires_in: number;
  };

  const now = Date.now();
  return {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    token_type: body.token_type,
    expires_at: now + body.expires_in * 1000,
    refresh_expires_at: now + body.x_refresh_token_expires_in * 1000,
    realm_id: realmId,
  };
}

export async function refreshAccessToken(
  refreshToken: string,
  realmId: string,
  config: OAuthConfig,
): Promise<TokenData> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Authorization: `Basic ${basicAuth(config.clientId, config.clientSecret)}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    // Don't leak raw Intuit response body
    throw new Error(
      `Token refresh failed (HTTP ${res.status}). Re-run \`node ~/.mcp-quickbooks/cli.mjs auth\` to re-authorize.`,
    );
  }

  const body = await res.json() as {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
    x_refresh_token_expires_in: number;
  };

  const now = Date.now();
  return {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    token_type: body.token_type,
    expires_at: now + body.expires_in * 1000,
    refresh_expires_at: now + body.x_refresh_token_expires_in * 1000,
    realm_id: realmId,
  };
}

export function startOAuthCallbackServer(
  config: OAuthConfig,
  expectedState: string,
  codeVerifier: string,
): Promise<TokenData> {
  return new Promise((resolve, reject) => {
    const redirectUrl = new URL(config.redirectUri);
    const port = parseInt(redirectUrl.port || "9876", 10);

    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      try {
        const url = new URL(req.url || "/", `http://localhost:${port}`);

        if (url.pathname !== redirectUrl.pathname) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not found");
          return;
        }

        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const realmId = url.searchParams.get("realmId");
        const error = url.searchParams.get("error");

        if (error) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end(`Authorization failed: ${error}`);
          cleanup();
          reject(new Error(`OAuth error: ${error}`));
          return;
        }

        if (!code || !realmId) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end("Missing code or realmId");
          cleanup();
          reject(new Error("Missing code or realmId in callback"));
          return;
        }

        if (state !== expectedState) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end("State mismatch — possible CSRF. Please retry.");
          cleanup();
          reject(new Error("OAuth state mismatch"));
          return;
        }

        const tokens = await exchangeCode(code, realmId, config, codeVerifier);
        await saveTokens(tokens);

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          "<h1>Authorization successful!</h1><p>You can close this window and return to the terminal.</p>",
        );
        cleanup();
        resolve(tokens);
      } catch (err) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Authorization failed. Check the terminal for details.");
        cleanup();
        reject(err);
      }
    });

    // Timeout: reject and close if no callback within 5 minutes
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("OAuth callback timed out after 5 minutes. Please try again."));
    }, CALLBACK_TIMEOUT_MS);

    function cleanup() {
      clearTimeout(timeout);
      server.close();
    }

    // Bind to localhost only — not 0.0.0.0
    server.listen(port, "127.0.0.1", () => {
      console.error(`OAuth callback server listening on 127.0.0.1:${port}`);
    });

    server.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}
