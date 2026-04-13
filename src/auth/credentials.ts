import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { z } from "zod";

export interface Credentials {
  clientId: string;
  clientSecret: string;
  sandbox: boolean;
}

const CONFIG_DIR = join(homedir(), ".mcp-quickbooks");
const CREDS_FILE = join(CONFIG_DIR, "credentials.json");

const CredentialsSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  sandbox: z.boolean(),
});

export async function loadCredentials(): Promise<Credentials | null> {
  try {
    const raw = await readFile(CREDS_FILE, "utf-8");
    return CredentialsSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export { CONFIG_DIR, CREDS_FILE };
