import { loadTokens, saveTokens } from "../auth/token-store.js";
import { refreshAccessToken } from "../auth/oauth.js";
import { getBaseUrl, withMinorVersion } from "./endpoints.js";
import type { TokenData } from "../auth/types.js";
import type { CompanyInfo, QBFault } from "./types.js";

const VALID_ENTITIES = new Set([
  "Customer", "Invoice", "Payment", "Vendor", "Item", "CompanyInfo",
  "Estimate", "Bill", "JournalEntry", "Account",
]);

const QBO_ID_RE = /^\d+$/;

const MAX_RESPONSE_BYTES = 100_000; // 100KB truncation limit for tool results

export class QuickBooksError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public fault?: QBFault,
  ) {
    super(message);
    this.name = "QuickBooksError";
  }
}

// Keywords that must not appear in user-supplied WHERE clauses
const QUERY_INJECTION_RE = /\b(MAXRESULTS|STARTPOSITION|ORDERBY)\b/i;

function validateWhere(where: string): void {
  if (QUERY_INJECTION_RE.test(where)) {
    throw new QuickBooksError(
      "Invalid query: WHERE clause must not contain MAXRESULTS, STARTPOSITION, or ORDERBY.",
      400,
    );
  }
}

function validateEntityId(id: string, label: string): void {
  if (!QBO_ID_RE.test(id)) {
    throw new QuickBooksError(
      `Invalid ${label}: must be a numeric ID.`,
      400,
    );
  }
}

function validateEntity(entity: string): void {
  if (!VALID_ENTITIES.has(entity)) {
    throw new QuickBooksError(
      `Invalid entity: ${entity}`,
      400,
    );
  }
}

export class QuickBooksClient {
  private tokens: TokenData | null = null;
  private refreshPromise: Promise<TokenData> | null = null;
  private sandbox: boolean;

  constructor(
    private clientId: string,
    private clientSecret: string,
  ) {
    this.sandbox = process.env.QBO_SANDBOX === "true";
  }

  private async getTokens(): Promise<TokenData> {
    if (!this.tokens) {
      this.tokens = await loadTokens();
    }
    if (!this.tokens) {
      throw new QuickBooksError(
        "Not authenticated. Run `node ~/.mcp-quickbooks/cli.mjs auth` to connect your QuickBooks account.",
        401,
      );
    }

    // Check if refresh token expired
    if (Date.now() >= this.tokens.refresh_expires_at) {
      throw new QuickBooksError(
        "Refresh token expired. Run `node ~/.mcp-quickbooks/cli.mjs auth` to re-authorize.",
        401,
      );
    }

    // Auto-refresh if access token expired or within 60s of expiry
    if (Date.now() >= this.tokens.expires_at - 60_000) {
      this.tokens = await this.doRefresh(this.tokens);
    }

    return this.tokens;
  }

  private async doRefresh(current: TokenData): Promise<TokenData> {
    // Prevent concurrent refresh calls
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const config = {
          clientId: this.clientId,
          clientSecret: this.clientSecret,
          redirectUri: "", // not needed for refresh
        };
        const refreshed = await refreshAccessToken(
          current.refresh_token,
          current.realm_id,
          config,
        );
        await saveTokens(refreshed);
        return refreshed;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const tokens = await this.getTokens();
    const usedAccessToken = tokens.access_token;
    const baseUrl = getBaseUrl(tokens.realm_id, this.sandbox);
    const url = withMinorVersion(`${baseUrl}${path}`);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${tokens.access_token}`,
      Accept: "application/json",
    };

    if (body) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401) {
      // Only refresh if the token hasn't already been rotated by a concurrent call
      if (!this.tokens || this.tokens.access_token === usedAccessToken) {
        this.tokens = await this.doRefresh(tokens);
      }
      // else: token was already refreshed by another concurrent call — use the new one

      const retryUrl = withMinorVersion(
        `${getBaseUrl(this.tokens!.realm_id, this.sandbox)}${path}`,
      );
      const retryRes = await fetch(retryUrl, {
        method,
        headers: {
          ...headers,
          Authorization: `Bearer ${this.tokens!.access_token}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!retryRes.ok) {
        await retryRes.text(); // drain body
        throw new QuickBooksError(
          `QuickBooks API error (${retryRes.status})`,
          retryRes.status,
        );
      }

      return (await retryRes.json()) as T;
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({})) as { Fault?: QBFault };
      const faultMsg = errBody.Fault?.Error?.[0]?.Message || "";
      // Omit Detail field — it may contain internal info
      throw new QuickBooksError(
        faultMsg
          ? `QuickBooks API error (${res.status}): ${faultMsg}`
          : `QuickBooks API error (${res.status})`,
        res.status,
        errBody.Fault,
      );
    }

    return (await res.json()) as T;
  }

  async query<T>(entity: string, where?: string, maxResults = 100): Promise<T[]> {
    validateEntity(entity);
    if (where) {
      validateWhere(where);
    }

    let sql = `SELECT * FROM ${entity}`;
    if (where) {
      sql += ` WHERE ${where}`;
    }
    sql += ` MAXRESULTS ${maxResults}`;

    const res = await this.request<{ QueryResponse: Record<string, T[]> }>(
      "GET",
      `/query?query=${encodeURIComponent(sql)}`,
    );

    return res.QueryResponse[entity] || [];
  }

  async read<T>(entity: string, id: string): Promise<T> {
    validateEntity(entity);
    validateEntityId(id, `${entity} ID`);

    const res = await this.request<Record<string, T>>(
      "GET",
      `/${entity.toLowerCase()}/${id}`,
    );
    return res[entity];
  }

  async create<T>(entity: string, body: unknown): Promise<T> {
    validateEntity(entity);

    const res = await this.request<Record<string, T>>(
      "POST",
      `/${entity.toLowerCase()}`,
      body,
    );
    return res[entity];
  }

  async update<T>(entity: string, body: unknown): Promise<T> {
    validateEntity(entity);

    const res = await this.request<Record<string, T>>(
      "POST",
      `/${entity.toLowerCase()}?operation=update`,
      body,
    );
    return res[entity];
  }

  async sendInvoice(invoiceId: string, email?: string): Promise<void> {
    validateEntityId(invoiceId, "Invoice ID");

    let path = `/invoice/${invoiceId}/send`;
    if (email) {
      path += `?sendTo=${encodeURIComponent(email)}`;
    }
    await this.request<unknown>("POST", path);
  }

  async getCompanyInfo(): Promise<CompanyInfo> {
    const tokens = await this.getTokens();
    return this.read<CompanyInfo>("CompanyInfo", tokens.realm_id);
  }

  async runReport(reportName: string, params?: Record<string, string>): Promise<unknown> {
    const qs = new URLSearchParams(params || {});
    const sep = qs.toString() ? `?${qs}` : "";
    return this.request<unknown>("GET", `/reports/${reportName}${sep}`);
  }
}

/** Truncate large JSON results to stay within reasonable MCP message sizes. */
export function truncateResult(data: unknown): string {
  const json = JSON.stringify(data, null, 2);
  if (json.length <= MAX_RESPONSE_BYTES) {
    return json;
  }
  return json.slice(0, MAX_RESPONSE_BYTES) + "\n\n... (truncated — results exceeded 100KB)";
}
