import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";

// loadCredentials reads from ~/.mcp-quickbooks/credentials.json.
// We test it by writing actual files in temp directories.
// The module uses os.homedir() to locate the file, so we need fresh imports.

describe("credentials", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "mcp-qb-cred-"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  async function loadWithHome(home: string) {
    // Mock os.homedir to point at our temp dir
    vi.doMock("node:os", () => ({ homedir: () => home }));
    const mod = await import("../../src/auth/credentials.js");
    return mod.loadCredentials();
  }

  it("returns null when file doesn't exist", async () => {
    const result = await loadWithHome(tempDir);
    expect(result).toBeNull();
  });

  it("returns null for invalid JSON", async () => {
    const mcpDir = join(tempDir, ".mcp-quickbooks");
    await mkdir(mcpDir, { recursive: true });
    await writeFile(join(mcpDir, "credentials.json"), "{invalid}", "utf-8");

    const result = await loadWithHome(tempDir);
    expect(result).toBeNull();
  });

  it("returns null when schema validation fails (missing sandbox)", async () => {
    const mcpDir = join(tempDir, ".mcp-quickbooks");
    await mkdir(mcpDir, { recursive: true });
    await writeFile(
      join(mcpDir, "credentials.json"),
      JSON.stringify({ clientId: "x", clientSecret: "y" }),
      "utf-8",
    );

    const result = await loadWithHome(tempDir);
    expect(result).toBeNull();
  });

  it("returns null for empty clientId", async () => {
    const mcpDir = join(tempDir, ".mcp-quickbooks");
    await mkdir(mcpDir, { recursive: true });
    await writeFile(
      join(mcpDir, "credentials.json"),
      JSON.stringify({ clientId: "", clientSecret: "y", sandbox: false }),
      "utf-8",
    );

    const result = await loadWithHome(tempDir);
    expect(result).toBeNull();
  });

  it("returns valid credentials", async () => {
    const mcpDir = join(tempDir, ".mcp-quickbooks");
    await mkdir(mcpDir, { recursive: true });
    const creds = { clientId: "abc", clientSecret: "def", sandbox: true };
    await writeFile(join(mcpDir, "credentials.json"), JSON.stringify(creds), "utf-8");

    const result = await loadWithHome(tempDir);
    expect(result).toEqual(creds);
  });

  it("validates sandbox is boolean (rejects string)", async () => {
    const mcpDir = join(tempDir, ".mcp-quickbooks");
    await mkdir(mcpDir, { recursive: true });
    await writeFile(
      join(mcpDir, "credentials.json"),
      JSON.stringify({ clientId: "a", clientSecret: "b", sandbox: "yes" }),
      "utf-8",
    );

    const result = await loadWithHome(tempDir);
    expect(result).toBeNull();
  });
});
