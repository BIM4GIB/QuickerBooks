import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { z } from "zod";
import type { TokenData } from "./types.js";

const CONFIG_DIR = join(homedir(), ".mcp-quickbooks");
const TOKEN_FILE = join(CONFIG_DIR, "tokens.json");

const TokenDataSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  token_type: z.string(),
  expires_at: z.number(),
  refresh_expires_at: z.number(),
  realm_id: z.string().min(1),
});

export async function loadTokens(): Promise<TokenData | null> {
  try {
    const raw = await readFile(TOKEN_FILE, "utf-8");
    return TokenDataSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function saveTokens(data: TokenData): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  await writeFile(TOKEN_FILE, JSON.stringify(data, null, 2), {
    encoding: "utf-8",
    mode: 0o600,
  });
}
