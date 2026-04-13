import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp, readFile, rm, stat, mkdir, writeFile } from "node:fs/promises";

describe("token-store", () => {
  let tempDir: string;

  const validTokens = {
    access_token: "at_123",
    refresh_token: "rt_456",
    token_type: "bearer",
    expires_at: Date.now() + 3600_000,
    refresh_expires_at: Date.now() + 86400_000 * 100,
    realm_id: "realm_789",
  };

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "mcp-qb-tok-"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  async function loadWithHome(home: string) {
    vi.doMock("node:os", () => ({ homedir: () => home }));
    const mod = await import("../../src/auth/token-store.js");
    return mod.loadTokens();
  }

  async function saveWithHome(home: string, data: typeof validTokens) {
    vi.doMock("node:os", () => ({ homedir: () => home }));
    const mod = await import("../../src/auth/token-store.js");
    return mod.saveTokens(data);
  }

  describe("saveTokens", () => {
    it("creates directory and writes file with restricted permissions", async () => {
      await saveWithHome(tempDir, validTokens);

      const filePath = join(tempDir, ".mcp-quickbooks", "tokens.json");
      const content = await readFile(filePath, "utf-8");
      expect(JSON.parse(content)).toEqual(validTokens);

      const fileStat = await stat(filePath);
      // Owner-only permissions
      expect(fileStat.mode & 0o077).toBe(0);
    });
  });

  describe("loadTokens", () => {
    it("returns null when file doesn't exist", async () => {
      const result = await loadWithHome(tempDir);
      expect(result).toBeNull();
    });

    it("returns null for invalid JSON", async () => {
      const mcpDir = join(tempDir, ".mcp-quickbooks");
      await mkdir(mcpDir, { recursive: true });
      await writeFile(join(mcpDir, "tokens.json"), "not valid json", "utf-8");

      const result = await loadWithHome(tempDir);
      expect(result).toBeNull();
    });

    it("returns null for JSON that fails zod validation (missing fields)", async () => {
      const mcpDir = join(tempDir, ".mcp-quickbooks");
      await mkdir(mcpDir, { recursive: true });
      await writeFile(join(mcpDir, "tokens.json"), JSON.stringify({ access_token: "x" }), "utf-8");

      const result = await loadWithHome(tempDir);
      expect(result).toBeNull();
    });

    it("returns valid token data when file is correct", async () => {
      const mcpDir = join(tempDir, ".mcp-quickbooks");
      await mkdir(mcpDir, { recursive: true });
      await writeFile(join(mcpDir, "tokens.json"), JSON.stringify(validTokens), "utf-8");

      const result = await loadWithHome(tempDir);
      expect(result).toEqual(validTokens);
    });

    it("returns null for empty access_token", async () => {
      const mcpDir = join(tempDir, ".mcp-quickbooks");
      await mkdir(mcpDir, { recursive: true });
      await writeFile(
        join(mcpDir, "tokens.json"),
        JSON.stringify({ ...validTokens, access_token: "" }),
        "utf-8",
      );

      const result = await loadWithHome(tempDir);
      expect(result).toBeNull();
    });
  });
});
